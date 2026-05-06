"""
Billing Engine for Mess Management System
==========================================
Calculates monthly bills for all active students based on:
  1. Meal logs (MessLog) for the given month
  2. Approved mess-off leaves (MessOff) — deducted from the bill
  3. Current meal rates (MealRate)

Auto-triggers fines when bills are not paid by the due date.

Usage:
    from mess_management.billing import generate_monthly_bills, trigger_fines_for_overdue_bills

    generate_monthly_bills(month=6, year=2025)
    trigger_fines_for_overdue_bills()
"""

import calendar
from datetime import date, timedelta
from decimal import Decimal
from django.utils import timezone
from django.conf import settings
from django.db.models import Sum

from .models import Student, MessLog, MealRate, MonthlyBill, Fine, MessOff


def get_meal_rates() -> dict:
    """
    Returns a dict like: {'breakfast': Decimal('50.00'), 'lunch': Decimal('80.00'), ...}
    Falls back to 0 if a meal type has no rate configured.
    """
    rates = {}
    for rate_obj in MealRate.objects.all():
        rates[rate_obj.meal_type] = rate_obj.rate
    # Default to 0 if any meal type is missing
    for meal in ['breakfast', 'lunch', 'dinner']:
        rates.setdefault(meal, Decimal('0.00'))
    return rates


def get_approved_off_dates(student: Student, month: int, year: int) -> set:
    """
    Returns a set of dates (within the given month) where the student
    has an approved mess-off leave. These days are excluded from billing.
    """
    off_dates = set()

    approved_offs = MessOff.objects.filter(
        student=student,
        status='approved',
    )

    month_start = date(year, month, 1)
    month_end   = date(year, month, calendar.monthrange(year, month)[1])

    for off in approved_offs:
        # Clamp the leave range to the billing month
        start = max(off.from_date, month_start)
        end   = min(off.to_date, month_end)

        current = start
        while current <= end:
            off_dates.add(current)
            current += timedelta(days=1)

    return off_dates


def calculate_student_bill(student: Student, month: int, year: int) -> Decimal:
    """
    Core billing function for one student.

    Steps:
      1. Fetch all meal logs for this student in the given month
      2. Remove logs that fall on approved mess-off dates
      3. Multiply each meal type count by its rate
      4. Return the total amount
    """
    rates    = get_meal_rates()
    off_dates = get_approved_off_dates(student, month, year)

    # Get all present meal logs for this student in this month
    logs = MessLog.objects.filter(
        student=student,
        date__month=month,
        date__year=year,
        is_present=True,
    )

    total = Decimal('0.00')

    for log in logs:
        # Skip meals on approved leave days
        if log.date in off_dates:
            continue
        meal_rate = rates.get(log.meal_type, Decimal('0.00'))
        total += meal_rate

    return total


def get_due_date(month: int, year: int) -> date:
    """
    Bills are due on PAYMENT_DUE_DAY of the NEXT month.
    E.g. May's bill is due on June 10.
    """
    due_day = getattr(settings, 'PAYMENT_DUE_DAY', 10)
    if month == 12:
        return date(year + 1, 1, due_day)
    return date(year, month + 1, due_day)


def generate_monthly_bills(month: int, year: int) -> dict:
    """
    Generates (or regenerates) bills for ALL active students.
    Safe to run multiple times — uses update_or_create.

    Returns a summary dict with counts and total revenue.
    """
    students = Student.objects.filter(status='active').select_related('user')
    due_date = get_due_date(month, year)

    created_count  = 0
    updated_count  = 0
    total_revenue  = Decimal('0.00')

    for student in students:
        amount = calculate_student_bill(student, month, year)

        bill, created = MonthlyBill.objects.update_or_create(
            student=student,
            month=month,
            year=year,
            defaults={
                'total_amount': amount,
                'due_date': due_date,
                # Only reset status if bill is being freshly created
                # (don't reset a 'paid' bill if regenerated)
            }
        )

        # If regenerated and was unpaid, update amount
        if not created and bill.status in ('unpaid', 'partial'):
            bill.total_amount = amount
            bill.save()

        total_revenue += amount

        if created:
            created_count += 1
        else:
            updated_count += 1

    return {
        'month': month,
        'year': year,
        'students_billed': len(students),
        'bills_created': created_count,
        'bills_updated': updated_count,
        'total_revenue': str(total_revenue),
    }


def trigger_fines_for_overdue_bills() -> dict:
    """
    Scans all unpaid bills past their due date and creates a Fine if one
    doesn't exist yet.

    Fine amount = bill.total_amount × FINE_PERCENTAGE (default 10%)

    Call this daily via a cron job or Django management command.
    """
    fine_percentage = Decimal(str(getattr(settings, 'FINE_PERCENTAGE', 0.10)))
    today = date.today()

    # Unpaid or partial bills whose due date has passed
    overdue_bills = MonthlyBill.objects.filter(
        status__in=['unpaid', 'partial'],
        due_date__lt=today,
    ).select_related('student')

    fines_created = 0
    fines_skipped = 0

    for bill in overdue_bills:
        # Only charge fine on the outstanding balance
        outstanding = bill.total_amount - bill.paid_amount
        fine_amount = (outstanding * fine_percentage).quantize(Decimal('0.01'))

        # Avoid duplicate fines — OneToOneField on bill
        if not Fine.objects.filter(bill=bill).exists():
            Fine.objects.create(
                bill=bill,
                student=bill.student,
                amount=fine_amount,
                reason=f"Late payment fine for {bill.month}/{bill.year}",
                status='active',
            )
            # Mark the bill as defaulter
            bill.status = 'defaulter'
            bill.save()
            fines_created += 1
        else:
            fines_skipped += 1

    return {
        'overdue_bills_checked': overdue_bills.count(),
        'fines_created': fines_created,
        'fines_already_existed': fines_skipped,
        'run_at': timezone.now().isoformat(),
    }


def get_student_summary(student: Student, month: int, year: int) -> dict:
    """
    Returns a full billing summary for one student for a given month.
    Used by the student dashboard API.
    """
    rates     = get_meal_rates()
    off_dates = get_approved_off_dates(student, month, year)

    logs = MessLog.objects.filter(
        student=student,
        date__month=month,
        date__year=year,
        is_present=True,
    )

    breakdown = {'breakfast': 0, 'lunch': 0, 'dinner': 0}
    for log in logs:
        if log.date not in off_dates:
            breakdown[log.meal_type] = breakdown.get(log.meal_type, 0) + 1

    total = sum(
        breakdown[meal] * rates.get(meal, Decimal('0.00'))
        for meal in breakdown
    )

    try:
        bill = MonthlyBill.objects.get(student=student, month=month, year=year)
        bill_data = {
            'id': bill.id,
            'total_amount': str(bill.total_amount),
            'paid_amount': str(bill.paid_amount),
            'balance_due': str(bill.balance_due),
            'status': bill.status,
            'due_date': str(bill.due_date),
        }
    except MonthlyBill.DoesNotExist:
        bill_data = None

    return {
        'student': student.roll_number,
        'month': month,
        'year': year,
        'meal_rates': {k: str(v) for k, v in rates.items()},
        'meal_counts': breakdown,
        'off_days': len(off_dates),
        'calculated_total': str(total),
        'bill': bill_data,
    }

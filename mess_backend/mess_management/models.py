"""
Models for Mess Management System
Maps all 8 database tables to Django ORM models.
"""

from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.utils import timezone


# ══════════════════════════════════════════════════════════════════════════════
# TABLE 1: USERS (Custom Auth User)
# ══════════════════════════════════════════════════════════════════════════════

class UserManager(BaseUserManager):
    """Custom manager to handle email-based login instead of username."""

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'admin')
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    TABLE 1: Users
    Replaces Django's default User. Supports Admin and Student roles.
    """
    ROLE_CHOICES = [
        ('admin',   'Admin'),
        ('student', 'Student'),
    ]

    email      = models.EmailField(unique=True)
    full_name  = models.CharField(max_length=150)
    role       = models.CharField(max_length=10, choices=ROLE_CHOICES, default='student')
    is_active  = models.BooleanField(default=True)
    is_staff   = models.BooleanField(default=False)       # access to Django admin
    created_at = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['full_name']

    class Meta:
        db_table = 'Users'

    def __str__(self):
        return f"{self.full_name} ({self.role})"

    @property
    def is_admin(self):
        return self.role == 'admin'


# ══════════════════════════════════════════════════════════════════════════════
# TABLE 2: STUDENTS
# ══════════════════════════════════════════════════════════════════════════════

class Student(models.Model):
    """
    TABLE 2: Students
    Extended profile for users with role='student'.
    One-to-one link to User table.
    """
    STATUS_CHOICES = [
        ('active',    'Active'),
        ('inactive',  'Inactive'),
        ('graduated', 'Graduated'),
    ]

    user         = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    roll_number  = models.CharField(max_length=20, unique=True)
    department   = models.CharField(max_length=100)
    room_number  = models.CharField(max_length=10, blank=True, null=True)
    phone        = models.CharField(max_length=15, blank=True, null=True)
    status       = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active')
    joined_date  = models.DateField(default=timezone.now)

    class Meta:
        db_table = 'Students'

    def __str__(self):
        return f"{self.roll_number} — {self.user.full_name}"


# ══════════════════════════════════════════════════════════════════════════════
# TABLE 3: MEAL RATES
# ══════════════════════════════════════════════════════════════════════════════

class MealRate(models.Model):
    """
    TABLE 3: Meal_Rates
    Stores the price for each type of meal.
    Admin can update these at any time.
    """
    MEAL_TYPE_CHOICES = [
        ('breakfast', 'Breakfast'),
        ('lunch',     'Lunch'),
        ('dinner',    'Dinner'),
    ]

    meal_type  = models.CharField(max_length=10, choices=MEAL_TYPE_CHOICES, unique=True)
    rate       = models.DecimalField(max_digits=8, decimal_places=2)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='rate_updates')

    class Meta:
        db_table = 'Meal_Rates'

    def __str__(self):
        return f"{self.meal_type}: Rs.{self.rate}"


# ══════════════════════════════════════════════════════════════════════════════
# TABLE 4: MESS LOGS
# ══════════════════════════════════════════════════════════════════════════════

class MessLog(models.Model):
    """
    TABLE 4: Mess_Logs
    Records every meal a student takes (check-in/check-out timestamp).
    Used by the billing engine to calculate monthly bills.
    """
    MEAL_TYPE_CHOICES = [
        ('breakfast', 'Breakfast'),
        ('lunch',     'Lunch'),
        ('dinner',    'Dinner'),
    ]

    student    = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='mess_logs')
    meal_type  = models.CharField(max_length=10, choices=MEAL_TYPE_CHOICES)
    date       = models.DateField(default=timezone.now)
    check_in   = models.DateTimeField(auto_now_add=True)
    check_out  = models.DateTimeField(null=True, blank=True)
    is_present = models.BooleanField(default=True)

    class Meta:
        db_table = 'Mess_Logs'
        # A student can only have one log per meal per day
        unique_together = ('student', 'meal_type', 'date')

    def __str__(self):
        return f"{self.student.roll_number} | {self.meal_type} | {self.date}"


# ══════════════════════════════════════════════════════════════════════════════
# TABLE 5: MONTHLY BILLS
# ══════════════════════════════════════════════════════════════════════════════

class MonthlyBill(models.Model):
    """
    TABLE 5: Monthly_Bills
    Auto-generated by the billing engine at the end of each month.
    Stores the total amount owed by each student.
    """
    STATUS_CHOICES = [
        ('unpaid',    'Unpaid'),
        ('paid',      'Paid'),
        ('partial',   'Partial'),
        ('defaulter', 'Defaulter'),
    ]

    student        = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='bills')
    month          = models.PositiveSmallIntegerField()      # 1–12
    year           = models.PositiveSmallIntegerField()
    total_amount   = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    paid_amount    = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status         = models.CharField(max_length=10, choices=STATUS_CHOICES, default='unpaid')
    generated_at   = models.DateTimeField(auto_now_add=True)
    due_date       = models.DateField(null=True, blank=True)

    class Meta:
        db_table = 'Monthly_Bills'
        unique_together = ('student', 'month', 'year')

    def __str__(self):
        return f"{self.student.roll_number} | {self.month}/{self.year} | Rs.{self.total_amount}"

    @property
    def balance_due(self):
        return self.total_amount - self.paid_amount


# ══════════════════════════════════════════════════════════════════════════════
# TABLE 6: PAYMENTS
# ══════════════════════════════════════════════════════════════════════════════

class Payment(models.Model):
    """
    TABLE 6: Payments
    Records every payment a student makes against a monthly bill.
    Multiple partial payments are supported.
    """
    METHOD_CHOICES = [
        ('cash',     'Cash'),
        ('online',   'Online Transfer'),
        ('cheque',   'Cheque'),
    ]

    bill           = models.ForeignKey(MonthlyBill, on_delete=models.CASCADE, related_name='payments')
    student        = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='payments')
    amount_paid    = models.DecimalField(max_digits=10, decimal_places=2)
    payment_method = models.CharField(max_length=10, choices=METHOD_CHOICES, default='cash')
    payment_date   = models.DateTimeField(auto_now_add=True)
    received_by    = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='received_payments')
    remarks        = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'Payments'

    def __str__(self):
        return f"{self.student.roll_number} paid Rs.{self.amount_paid} on {self.payment_date.date()}"


# ══════════════════════════════════════════════════════════════════════════════
# TABLE 7: FINES
# ══════════════════════════════════════════════════════════════════════════════

class Fine(models.Model):
    """
    TABLE 7: Fines
    Auto-triggered when a monthly bill is not paid by the due date.
    Linked to a specific monthly bill.
    """
    STATUS_CHOICES = [
        ('active',   'Active'),
        ('paid',     'Paid'),
        ('waived',   'Waived'),
    ]

    bill        = models.OneToOneField(MonthlyBill, on_delete=models.CASCADE, related_name='fine')
    student     = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='fines')
    amount      = models.DecimalField(max_digits=10, decimal_places=2)
    reason      = models.CharField(max_length=255, default='Late payment fine')
    status      = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active')
    issued_at   = models.DateTimeField(auto_now_add=True)
    waived_by   = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='waived_fines'
    )

    class Meta:
        db_table = 'Fines'

    def __str__(self):
        return f"Fine Rs.{self.amount} — {self.student.roll_number} ({self.status})"


# ══════════════════════════════════════════════════════════════════════════════
# TABLE 8: MESS OFF (Leave Requests)
# ══════════════════════════════════════════════════════════════════════════════

class MessOff(models.Model):
    """
    TABLE 8: Mess_Off
    Students can request mess leave for specific date ranges.
    Admin approves or rejects. Approved leaves reduce the monthly bill.
    """
    STATUS_CHOICES = [
        ('pending',  'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    student      = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='mess_off_requests')
    from_date    = models.DateField()
    to_date      = models.DateField()
    reason       = models.TextField(blank=True, null=True)
    status       = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    requested_at = models.DateTimeField(auto_now_add=True)
    reviewed_by  = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_mess_offs'
    )
    reviewed_at  = models.DateTimeField(null=True, blank=True)
    admin_note   = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'Mess_Off'

    def __str__(self):
        return f"{self.student.roll_number} off {self.from_date} → {self.to_date} ({self.status})"

    @property
    def total_days(self):
        return (self.to_date - self.from_date).days + 1

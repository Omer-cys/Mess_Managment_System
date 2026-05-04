"""
API Views for Mess Management System
=====================================
Every endpoint is documented with its URL, method, and who can access it.
"""

from datetime import date
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User, Student, MealRate, MessLog, MonthlyBill, Payment, Fine, MessOff
from .serializers import (
    LoginSerializer, UserSerializer, RegisterUserSerializer, ChangePasswordSerializer,
    StudentSerializer, CreateStudentSerializer, UpdateStudentSerializer,
    MealRateSerializer,
    MessLogSerializer, CheckOutSerializer,
    MonthlyBillSerializer,
    PaymentSerializer,
    FineSerializer, WaiveFineSerializer,
    MessOffSerializer, ReviewMessOffSerializer,
)
from .permissions import IsAdmin, IsStudent, IsAdminOrReadOnly, IsOwnerOrAdmin
from .billing import generate_monthly_bills, trigger_fines_for_overdue_bills, get_student_summary


# ══════════════════════════════════════════════════════════════════════════════
# AUTH VIEWS
# ══════════════════════════════════════════════════════════════════════════════

class LoginView(APIView):
    """
    POST /api/auth/login/
    Body: { email, password }
    Returns: access token, refresh token, user info
    Access: Anyone (public)
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']
        refresh = RefreshToken.for_user(user)

        return Response({
            'access':  str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id':        user.id,
                'email':     user.email,
                'full_name': user.full_name,
                'role':      user.role,
            }
        }, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Body: { refresh }
    Access: Authenticated users
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            token = RefreshToken(request.data['refresh'])
            token.blacklist()
            return Response({'message': 'Logged out successfully.'}, status=status.HTTP_200_OK)
        except Exception:
            return Response({'error': 'Invalid token.'}, status=status.HTTP_400_BAD_REQUEST)


class ChangePasswordView(APIView):
    """
    POST /api/auth/change-password/
    Body: { old_password, new_password }
    Access: Authenticated users (own password only)
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'message': 'Password changed successfully.'})


class MeView(APIView):
    """
    GET /api/auth/me/
    Returns the currently logged-in user's profile.
    Access: Authenticated users
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


# ══════════════════════════════════════════════════════════════════════════════
# USER VIEWS (Admin only)
# ══════════════════════════════════════════════════════════════════════════════

class UserListCreateView(APIView):
    """
    GET  /api/users/       → List all users
    POST /api/users/       → Register a new user (admin/student)
    Access: Admin only
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        role = request.query_params.get('role')
        users = User.objects.all().order_by('-created_at')
        if role:
            users = users.filter(role=role)
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = RegisterUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class UserDetailView(APIView):
    """
    GET    /api/users/<id>/   → Get user details
    PATCH  /api/users/<id>/   → Update user (activate/deactivate)
    DELETE /api/users/<id>/   → Delete user
    Access: Admin only
    """
    permission_classes = [IsAdmin]

    def get(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        return Response(UserSerializer(user).data)

    def patch(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        # Only allow toggling is_active or updating full_name
        allowed_fields = {'is_active', 'full_name'}
        data = {k: v for k, v in request.data.items() if k in allowed_fields}
        serializer = UserSerializer(user, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        user.delete()
        return Response({'message': 'User deleted.'}, status=status.HTTP_204_NO_CONTENT)


# ══════════════════════════════════════════════════════════════════════════════
# STUDENT VIEWS
# ══════════════════════════════════════════════════════════════════════════════

class StudentListCreateView(APIView):
    """
    GET  /api/students/     → List all students (Admin) or own profile (Student)
    POST /api/students/     → Create new student (Admin only)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role == 'admin':
            status_filter = request.query_params.get('status')
            students = Student.objects.select_related('user').all()
            if status_filter:
                students = students.filter(status=status_filter)
            serializer = StudentSerializer(students, many=True)
            return Response(serializer.data)
        else:
            # Student can only see their own profile
            try:
                student = Student.objects.get(user=request.user)
                return Response(StudentSerializer(student).data)
            except Student.DoesNotExist:
                return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

    def post(self, request):
        if request.user.role != 'admin':
            return Response({'error': 'Only admins can create students.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = CreateStudentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        student = serializer.save()
        return Response(StudentSerializer(student).data, status=status.HTTP_201_CREATED)


class StudentDetailView(APIView):
    """
    GET   /api/students/<id>/   → Get student details
    PATCH /api/students/<id>/   → Update student profile
    Access: Admin (any), Student (own only)
    """
    permission_classes = [IsAuthenticated]

    def _get_student(self, pk, user):
        student = get_object_or_404(Student, pk=pk)
        if user.role != 'admin' and student.user != user:
            return None, Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
        return student, None

    def get(self, request, pk):
        student, err = self._get_student(pk, request.user)
        if err:
            return err
        return Response(StudentSerializer(student).data)

    def patch(self, request, pk):
        student, err = self._get_student(pk, request.user)
        if err:
            return err
        serializer = UpdateStudentSerializer(student, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(StudentSerializer(student).data)


class StudentDashboardView(APIView):
    """
    GET /api/students/dashboard/
    Returns a student's own full dashboard:
    current bill, recent logs, fines, mess-off requests.
    Access: Student only
    """
    permission_classes = [IsStudent]

    def get(self, request):
        try:
            student = Student.objects.get(user=request.user)
        except Student.DoesNotExist:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        today = date.today()
        month = int(request.query_params.get('month', today.month))
        year  = int(request.query_params.get('year',  today.year))

        # Billing summary from engine
        summary = get_student_summary(student, month, year)

        # Recent 10 meal logs
        recent_logs = MessLog.objects.filter(student=student).order_by('-date')[:10]

        # Active fines
        active_fines = Fine.objects.filter(student=student, status='active')

        # Pending mess-off requests
        pending_off = MessOff.objects.filter(student=student, status='pending')

        return Response({
            'student': StudentSerializer(student).data,
            'billing_summary': summary,
            'recent_logs': MessLogSerializer(recent_logs, many=True).data,
            'active_fines': FineSerializer(active_fines, many=True).data,
            'pending_mess_off': MessOffSerializer(pending_off, many=True).data,
        })


# ══════════════════════════════════════════════════════════════════════════════
# MEAL RATE VIEWS
# ══════════════════════════════════════════════════════════════════════════════

class MealRateListView(APIView):
    """
    GET  /api/meal-rates/         → View all meal rates (everyone)
    POST /api/meal-rates/         → Set/update a meal rate (Admin only)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rates = MealRate.objects.all()
        return Response(MealRateSerializer(rates, many=True).data)

    def post(self, request):
        if request.user.role != 'admin':
            return Response({'error': 'Admin only.'}, status=status.HTTP_403_FORBIDDEN)

        meal_type = request.data.get('meal_type')
        # Update existing or create new
        try:
            rate_obj = MealRate.objects.get(meal_type=meal_type)
            serializer = MealRateSerializer(rate_obj, data=request.data, partial=True)
        except MealRate.DoesNotExist:
            serializer = MealRateSerializer(data=request.data)

        serializer.is_valid(raise_exception=True)
        rate_obj = serializer.save(updated_by=request.user)
        return Response(MealRateSerializer(rate_obj).data, status=status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
# MESS LOG VIEWS
# ══════════════════════════════════════════════════════════════════════════════

class MessLogListCreateView(APIView):
    """
    GET  /api/mess-logs/                  → All logs (Admin) | own logs (Student)
    POST /api/mess-logs/                  → Record a meal check-in
         Body: { student (id), meal_type }
    Query params: ?student=<id>&month=<m>&year=<y>&meal_type=<type>
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        logs = MessLog.objects.select_related('student__user').order_by('-date', '-check_in')

        if request.user.role == 'student':
            # Student only sees their own logs
            try:
                student = Student.objects.get(user=request.user)
                logs = logs.filter(student=student)
            except Student.DoesNotExist:
                return Response([])

        # Optional filters
        student_id = request.query_params.get('student')
        month      = request.query_params.get('month')
        year       = request.query_params.get('year')
        meal_type  = request.query_params.get('meal_type')

        if student_id and request.user.role == 'admin':
            logs = logs.filter(student_id=student_id)
        if month:
            logs = logs.filter(date__month=month)
        if year:
            logs = logs.filter(date__year=year)
        if meal_type:
            logs = logs.filter(meal_type=meal_type)

        return Response(MessLogSerializer(logs, many=True).data)

    def post(self, request):
        """Record that a student has had a meal (check-in)."""
        serializer = MessLogSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        student    = serializer.validated_data['student']
        meal_type  = serializer.validated_data['meal_type']
        log_date   = serializer.validated_data.get('date', date.today())

        # Prevent duplicate logs
        if MessLog.objects.filter(student=student, meal_type=meal_type, date=log_date).exists():
            return Response(
                {'error': f'{student.roll_number} already has a {meal_type} log for {log_date}.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        log = serializer.save()
        return Response(MessLogSerializer(log).data, status=status.HTTP_201_CREATED)


class MessLogCheckOutView(APIView):
    """
    POST /api/mess-logs/checkout/
    Body: { log_id }
    Records the check-out time for an existing log.
    Access: Admin only
    """
    permission_classes = [IsAdmin]

    def post(self, request):
        serializer = CheckOutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        log = get_object_or_404(MessLog, pk=serializer.validated_data['log_id'])
        if log.check_out:
            return Response({'error': 'Already checked out.'}, status=status.HTTP_400_BAD_REQUEST)

        log.check_out = timezone.now()
        log.save()
        return Response(MessLogSerializer(log).data)


# ══════════════════════════════════════════════════════════════════════════════
# BILLING VIEWS
# ══════════════════════════════════════════════════════════════════════════════

class GenerateBillsView(APIView):
    """
    POST /api/billing/generate/
    Body: { month, year }
    Triggers the billing engine for all active students.
    Access: Admin only
    """
    permission_classes = [IsAdmin]

    def post(self, request):
        month = request.data.get('month', date.today().month)
        year  = request.data.get('year',  date.today().year)

        try:
            month = int(month)
            year  = int(year)
            if not (1 <= month <= 12):
                raise ValueError
        except (TypeError, ValueError):
            return Response({'error': 'Invalid month or year.'}, status=status.HTTP_400_BAD_REQUEST)

        result = generate_monthly_bills(month, year)
        return Response({'message': 'Bills generated successfully.', 'summary': result})


class MonthlyBillListView(APIView):
    """
    GET /api/bills/
    Query params: ?month=<m>&year=<y>&status=<status>&student=<id>
    Admin sees all. Student sees own bills only.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        bills = MonthlyBill.objects.select_related('student__user').order_by('-year', '-month')

        if request.user.role == 'student':
            try:
                student = Student.objects.get(user=request.user)
                bills = bills.filter(student=student)
            except Student.DoesNotExist:
                return Response([])
        else:
            # Admin filters
            student_id    = request.query_params.get('student')
            bill_status   = request.query_params.get('status')
            if student_id:
                bills = bills.filter(student_id=student_id)
            if bill_status:
                bills = bills.filter(status=bill_status)

        month = request.query_params.get('month')
        year  = request.query_params.get('year')
        if month:
            bills = bills.filter(month=month)
        if year:
            bills = bills.filter(year=year)

        return Response(MonthlyBillSerializer(bills, many=True).data)


class MonthlyBillDetailView(APIView):
    """
    GET /api/bills/<id>/
    Access: Admin (any bill), Student (own bill only)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        bill = get_object_or_404(MonthlyBill, pk=pk)

        if request.user.role == 'student':
            try:
                student = Student.objects.get(user=request.user)
                if bill.student != student:
                    return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
            except Student.DoesNotExist:
                return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(MonthlyBillSerializer(bill).data)


# ══════════════════════════════════════════════════════════════════════════════
# PAYMENT VIEWS
# ══════════════════════════════════════════════════════════════════════════════

class PaymentListCreateView(APIView):
    """
    GET  /api/payments/              → List payments
    POST /api/payments/              → Record a payment
         Body: { bill, student, amount_paid, payment_method, remarks }
    Access: Admin (full), Student (own only)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        payments = Payment.objects.select_related('student__user', 'bill').order_by('-payment_date')

        if request.user.role == 'student':
            try:
                student = Student.objects.get(user=request.user)
                payments = payments.filter(student=student)
            except Student.DoesNotExist:
                return Response([])

        student_id = request.query_params.get('student')
        if student_id and request.user.role == 'admin':
            payments = payments.filter(student_id=student_id)

        return Response(PaymentSerializer(payments, many=True).data)

    def post(self, request):
        if request.user.role != 'admin':
            return Response({'error': 'Only admins can record payments.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = PaymentSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        payment = serializer.save()
        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


# ══════════════════════════════════════════════════════════════════════════════
# FINE VIEWS
# ══════════════════════════════════════════════════════════════════════════════

class TriggerFinesView(APIView):
    """
    POST /api/fines/trigger/
    Manually runs the fine engine (also runs on cron).
    Access: Admin only
    """
    permission_classes = [IsAdmin]

    def post(self, request):
        result = trigger_fines_for_overdue_bills()
        return Response({'message': 'Fine check complete.', 'summary': result})


class FineListView(APIView):
    """
    GET /api/fines/
    Query params: ?student=<id>&status=<status>
    Admin sees all. Student sees own fines.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        fines = Fine.objects.select_related('student__user', 'bill').order_by('-issued_at')

        if request.user.role == 'student':
            try:
                student = Student.objects.get(user=request.user)
                fines = fines.filter(student=student)
            except Student.DoesNotExist:
                return Response([])
        else:
            student_id    = request.query_params.get('student')
            fine_status   = request.query_params.get('status')
            if student_id:
                fines = fines.filter(student_id=student_id)
            if fine_status:
                fines = fines.filter(status=fine_status)

        return Response(FineSerializer(fines, many=True).data)


class WaiveFineView(APIView):
    """
    POST /api/fines/waive/
    Body: { fine_id }
    Marks a fine as waived (admin discretion).
    Access: Admin only
    """
    permission_classes = [IsAdmin]

    def post(self, request):
        serializer = WaiveFineSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        fine = get_object_or_404(Fine, pk=serializer.validated_data['fine_id'])
        fine.status    = 'waived'
        fine.waived_by = request.user
        fine.save()

        # Revert bill status from defaulter to unpaid/partial
        bill = fine.bill
        if bill.status == 'defaulter':
            bill.status = 'unpaid' if bill.paid_amount == 0 else 'partial'
            bill.save()

        return Response({'message': f'Fine #{fine.id} waived.', 'fine': FineSerializer(fine).data})


# ══════════════════════════════════════════════════════════════════════════════
# MESS OFF VIEWS
# ══════════════════════════════════════════════════════════════════════════════

class MessOffListCreateView(APIView):
    """
    GET  /api/mess-off/           → List requests
    POST /api/mess-off/           → Submit a leave request (Student)
         Body: { from_date, to_date, reason }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        requests = MessOff.objects.select_related('student__user').order_by('-requested_at')

        if request.user.role == 'student':
            try:
                student = Student.objects.get(user=request.user)
                requests = requests.filter(student=student)
            except Student.DoesNotExist:
                return Response([])
        else:
            # Admin filters
            req_status = request.query_params.get('status')
            student_id = request.query_params.get('student')
            if req_status:
                requests = requests.filter(status=req_status)
            if student_id:
                requests = requests.filter(student_id=student_id)

        return Response(MessOffSerializer(requests, many=True).data)

    def post(self, request):
        if request.user.role != 'student':
            return Response({'error': 'Only students can submit mess-off requests.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            student = Student.objects.get(user=request.user)
        except Student.DoesNotExist:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data.copy()
        data['student'] = student.id

        serializer = MessOffSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        mess_off = serializer.save()
        return Response(MessOffSerializer(mess_off).data, status=status.HTTP_201_CREATED)


class MessOffDetailView(APIView):
    """
    GET    /api/mess-off/<id>/   → Get details of a request
    DELETE /api/mess-off/<id>/   → Cancel pending request (Student own, or Admin)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        off = get_object_or_404(MessOff, pk=pk)
        if request.user.role == 'student':
            student = get_object_or_404(Student, user=request.user)
            if off.student != student:
                return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
        return Response(MessOffSerializer(off).data)

    def delete(self, request, pk):
        off = get_object_or_404(MessOff, pk=pk)

        if request.user.role == 'student':
            student = get_object_or_404(Student, user=request.user)
            if off.student != student:
                return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
            if off.status != 'pending':
                return Response({'error': 'Cannot cancel a reviewed request.'}, status=status.HTTP_400_BAD_REQUEST)

        off.delete()
        return Response({'message': 'Mess-off request cancelled.'}, status=status.HTTP_204_NO_CONTENT)


class ReviewMessOffView(APIView):
    """
    POST /api/mess-off/<id>/review/
    Body: { status: 'approved'|'rejected', admin_note: '...' }
    Admin approves or rejects a pending mess-off request.
    Access: Admin only
    """
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        off = get_object_or_404(MessOff, pk=pk)

        if off.status != 'pending':
            return Response({'error': 'This request has already been reviewed.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = ReviewMessOffSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        off.status      = serializer.validated_data['status']
        off.admin_note  = serializer.validated_data.get('admin_note', '')
        off.reviewed_by = request.user
        off.reviewed_at = timezone.now()
        off.save()

        action = 'approved' if off.status == 'approved' else 'rejected'
        return Response({
            'message': f'Mess-off request {action}.',
            'mess_off': MessOffSerializer(off).data,
        })


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN DASHBOARD / REPORTS
# ══════════════════════════════════════════════════════════════════════════════

class AdminDashboardView(APIView):
    """
    GET /api/admin/dashboard/
    Returns overall system statistics for the admin panel.
    Access: Admin only
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        from django.db.models import Sum

        today = date.today()

        total_students  = Student.objects.filter(status='active').count()
        total_revenue   = Payment.objects.aggregate(total=Sum('amount_paid'))['total'] or 0
        unpaid_bills    = MonthlyBill.objects.filter(status__in=['unpaid', 'partial', 'defaulter']).count()
        active_fines    = Fine.objects.filter(status='active').count()
        pending_off     = MessOff.objects.filter(status='pending').count()

        return Response({
            'total_students':    total_students,
            'total_revenue':     str(total_revenue),
            'unpaid_bills':      unpaid_bills,
            'active_fines':      active_fines,
            'pending_mess_off':  pending_off,
            'date':              str(today),
        })


class DefaulterListView(APIView):
    """
    GET /api/admin/defaulters/
    Lists students with unpaid bills or active fines.
    Access: Admin only
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        defaulter_bills = MonthlyBill.objects.filter(
            status__in=['unpaid', 'partial', 'defaulter']
        ).select_related('student__user').order_by('-year', '-month')

        return Response({
            'defaulters': MonthlyBillSerializer(defaulter_bills, many=True).data,
            'count': defaulter_bills.count(),
        })

"""
Serializers for Mess Management System
Converts model instances <-> JSON for the REST API.
"""

from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User, Student, MealRate, MessLog, MonthlyBill, Payment, Fine, MessOff


# ══════════════════════════════════════════════════════════════════════════════
# AUTH SERIALIZERS
# ══════════════════════════════════════════════════════════════════════════════

class LoginSerializer(serializers.Serializer):
    """Used to validate login credentials."""
    email    = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        user = authenticate(email=data['email'], password=data['password'])
        if not user:
            raise serializers.ValidationError("Invalid email or password.")
        if not user.is_active:
            raise serializers.ValidationError("This account has been deactivated.")
        data['user'] = user
        return data


# ══════════════════════════════════════════════════════════════════════════════
# USER SERIALIZERS
# ══════════════════════════════════════════════════════════════════════════════

class UserSerializer(serializers.ModelSerializer):
    """Read serializer — returns safe user info (no password)."""
    class Meta:
        model  = User
        fields = ['id', 'email', 'full_name', 'role', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class RegisterUserSerializer(serializers.ModelSerializer):
    """Write serializer — used when creating a new user (admin or student)."""
    password  = serializers.CharField(write_only=True, min_length=8)
    password2 = serializers.CharField(write_only=True, label='Confirm Password')

    class Meta:
        model  = User
        fields = ['email', 'full_name', 'role', 'password', 'password2']

    def validate(self, data):
        if data['password'] != data['password2']:
            raise serializers.ValidationError({"password2": "Passwords do not match."})
        return data

    def create(self, validated_data):
        validated_data.pop('password2')
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")
        return value

    def save(self):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()


# ══════════════════════════════════════════════════════════════════════════════
# STUDENT SERIALIZERS
# ══════════════════════════════════════════════════════════════════════════════

class StudentSerializer(serializers.ModelSerializer):
    """Detailed view of a student, includes nested user info."""
    user      = UserSerializer(read_only=True)
    full_name = serializers.CharField(source='user.full_name', read_only=True)
    email     = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model  = Student
        fields = [
            'id', 'user', 'full_name', 'email',
            'roll_number', 'department', 'room_number',
            'phone', 'status', 'joined_date',
        ]
        read_only_fields = ['id']


class CreateStudentSerializer(serializers.Serializer):
    """
    Creates a User + Student profile in one API call.
    POST /api/students/
    """
    # User fields
    email     = serializers.EmailField()
    full_name = serializers.CharField(max_length=150)
    password  = serializers.CharField(write_only=True, min_length=8)

    # Student profile fields
    roll_number = serializers.CharField(max_length=20)
    department  = serializers.CharField(max_length=100)
    room_number = serializers.CharField(max_length=10, required=False, allow_blank=True)
    phone       = serializers.CharField(max_length=15, required=False, allow_blank=True)

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_roll_number(self, value):
        if Student.objects.filter(roll_number=value).exists():
            raise serializers.ValidationError("This roll number is already registered.")
        return value

    def create(self, validated_data):
        # Create the User account
        user = User.objects.create_user(
            email=validated_data['email'],
            full_name=validated_data['full_name'],
            password=validated_data['password'],
            role='student',
        )
        # Create the Student profile
        student = Student.objects.create(
            user=user,
            roll_number=validated_data['roll_number'],
            department=validated_data['department'],
            room_number=validated_data.get('room_number', ''),
            phone=validated_data.get('phone', ''),
        )
        return student


class UpdateStudentSerializer(serializers.ModelSerializer):
    """Used for PATCH requests to update student profile fields."""
    class Meta:
        model  = Student
        fields = ['department', 'room_number', 'phone', 'status']


# ══════════════════════════════════════════════════════════════════════════════
# MEAL RATE SERIALIZER
# ══════════════════════════════════════════════════════════════════════════════

class MealRateSerializer(serializers.ModelSerializer):
    updated_by_name = serializers.CharField(source='updated_by.full_name', read_only=True)

    class Meta:
        model  = MealRate
        fields = ['id', 'meal_type', 'rate', 'updated_at', 'updated_by_name']
        read_only_fields = ['id', 'updated_at', 'updated_by_name']


# ══════════════════════════════════════════════════════════════════════════════
# MESS LOG SERIALIZER
# ══════════════════════════════════════════════════════════════════════════════

class MessLogSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    roll_number  = serializers.CharField(source='student.roll_number', read_only=True)

    class Meta:
        model  = MessLog
        fields = [
            'id', 'student', 'student_name', 'roll_number',
            'meal_type', 'date', 'check_in', 'check_out', 'is_present',
        ]
        read_only_fields = ['id', 'check_in', 'student_name', 'roll_number']


class CheckOutSerializer(serializers.Serializer):
    """Used to record check-out time for an existing mess log."""
    log_id = serializers.IntegerField()


# ══════════════════════════════════════════════════════════════════════════════
# MONTHLY BILL SERIALIZER
# ══════════════════════════════════════════════════════════════════════════════

class MonthlyBillSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    roll_number  = serializers.CharField(source='student.roll_number', read_only=True)
    balance_due  = serializers.ReadOnlyField()

    class Meta:
        model  = MonthlyBill
        fields = [
            'id', 'student', 'student_name', 'roll_number',
            'month', 'year', 'total_amount', 'paid_amount',
            'balance_due', 'status', 'generated_at', 'due_date',
        ]
        read_only_fields = ['id', 'generated_at', 'balance_due']


# ══════════════════════════════════════════════════════════════════════════════
# PAYMENT SERIALIZER
# ══════════════════════════════════════════════════════════════════════════════

class PaymentSerializer(serializers.ModelSerializer):
    student_name   = serializers.CharField(source='student.user.full_name', read_only=True)
    received_by_name = serializers.CharField(source='received_by.full_name', read_only=True)

    class Meta:
        model  = Payment
        fields = [
            'id', 'bill', 'student', 'student_name',
            'amount_paid', 'payment_method', 'payment_date',
            'received_by', 'received_by_name', 'remarks',
        ]
        read_only_fields = ['id', 'payment_date', 'received_by', 'student_name', 'received_by_name']

    def validate(self, data):
        bill = data['bill']
        # Prevent overpayment
        if data['amount_paid'] > bill.balance_due:
            raise serializers.ValidationError(
                f"Amount exceeds balance due (Rs.{bill.balance_due}). Cannot overpay."
            )
        return data

    def create(self, validated_data):
        request = self.context['request']
        validated_data['received_by'] = request.user
        payment = super().create(validated_data)

        # Update bill paid_amount and status
        bill = payment.bill
        bill.paid_amount += payment.amount_paid
        if bill.paid_amount >= bill.total_amount:
            bill.status = 'paid'
            # If a fine exists and bill is now paid, mark fine as paid too
            if hasattr(bill, 'fine'):
                bill.fine.status = 'paid'
                bill.fine.save()
        elif bill.paid_amount > 0:
            bill.status = 'partial'
        bill.save()

        return payment


# ══════════════════════════════════════════════════════════════════════════════
# FINE SERIALIZER
# ══════════════════════════════════════════════════════════════════════════════

class FineSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.user.full_name', read_only=True)
    roll_number  = serializers.CharField(source='student.roll_number', read_only=True)
    waived_by_name = serializers.CharField(source='waived_by.full_name', read_only=True)

    class Meta:
        model  = Fine
        fields = [
            'id', 'bill', 'student', 'student_name', 'roll_number',
            'amount', 'reason', 'status', 'issued_at',
            'waived_by', 'waived_by_name',
        ]
        read_only_fields = ['id', 'issued_at', 'student_name', 'roll_number', 'waived_by_name']


class WaiveFineSerializer(serializers.Serializer):
    """Admin uses this to waive a fine."""
    fine_id = serializers.IntegerField()


# ══════════════════════════════════════════════════════════════════════════════
# MESS OFF SERIALIZER
# ══════════════════════════════════════════════════════════════════════════════

class MessOffSerializer(serializers.ModelSerializer):
    student_name  = serializers.CharField(source='student.user.full_name', read_only=True)
    roll_number   = serializers.CharField(source='student.roll_number', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.full_name', read_only=True)
    total_days    = serializers.ReadOnlyField()

    class Meta:
        model  = MessOff
        fields = [
            'id', 'student', 'student_name', 'roll_number',
            'from_date', 'to_date', 'total_days', 'reason',
            'status', 'requested_at', 'reviewed_by', 'reviewed_by_name',
            'reviewed_at', 'admin_note',
        ]
        read_only_fields = [
            'id', 'status', 'requested_at',
            'reviewed_by', 'reviewed_at', 'admin_note',
            'student_name', 'roll_number', 'reviewed_by_name',
        ]

    def validate(self, data):
        if data['from_date'] > data['to_date']:
            raise serializers.ValidationError("from_date cannot be after to_date.")
        return data


class ReviewMessOffSerializer(serializers.Serializer):
    """Admin uses this to approve or reject a mess-off request."""
    status     = serializers.ChoiceField(choices=['approved', 'rejected'])
    admin_note = serializers.CharField(required=False, allow_blank=True)


# ══════════════════════════════════════════════════════════════════════════════
# DASHBOARD / SUMMARY SERIALIZERS
# ══════════════════════════════════════════════════════════════════════════════

class StudentDashboardSerializer(serializers.Serializer):
    """Summary data for the student's own dashboard."""
    student      = StudentSerializer()
    current_bill = MonthlyBillSerializer(allow_null=True)
    active_fines = FineSerializer(many=True)
    pending_mess_off = MessOffSerializer(many=True)
    recent_logs  = MessLogSerializer(many=True)


class AdminDashboardSerializer(serializers.Serializer):
    """Summary stats for admin overview."""
    total_students  = serializers.IntegerField()
    total_revenue   = serializers.DecimalField(max_digits=12, decimal_places=2)
    unpaid_bills    = serializers.IntegerField()
    active_fines    = serializers.IntegerField()
    pending_mess_off = serializers.IntegerField()

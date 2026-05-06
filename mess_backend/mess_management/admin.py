"""
Django Admin registration for Mess Management System.
Access the admin panel at: http://localhost:8000/admin/
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Student, MealRate, MessLog, MonthlyBill, Payment, Fine, MessOff


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display    = ['email', 'full_name', 'role', 'is_active', 'created_at']
    list_filter     = ['role', 'is_active']
    search_fields   = ['email', 'full_name']
    ordering        = ['-created_at']
    fieldsets       = (
        (None, {'fields': ('email', 'password')}),
        ('Personal Info', {'fields': ('full_name', 'role')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
    )
    add_fieldsets   = (
        (None, {'classes': ('wide',), 'fields': ('email', 'full_name', 'role', 'password1', 'password2')}),
    )


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display  = ['roll_number', 'user', 'department', 'room_number', 'status']
    list_filter   = ['status', 'department']
    search_fields = ['roll_number', 'user__full_name', 'user__email']


@admin.register(MealRate)
class MealRateAdmin(admin.ModelAdmin):
    list_display = ['meal_type', 'rate', 'updated_at', 'updated_by']


@admin.register(MessLog)
class MessLogAdmin(admin.ModelAdmin):
    list_display  = ['student', 'meal_type', 'date', 'check_in', 'check_out', 'is_present']
    list_filter   = ['meal_type', 'is_present', 'date']
    search_fields = ['student__roll_number', 'student__user__full_name']
    date_hierarchy = 'date'


@admin.register(MonthlyBill)
class MonthlyBillAdmin(admin.ModelAdmin):
    list_display  = ['student', 'month', 'year', 'total_amount', 'paid_amount', 'status', 'due_date']
    list_filter   = ['status', 'month', 'year']
    search_fields = ['student__roll_number', 'student__user__full_name']


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display  = ['student', 'amount_paid', 'payment_method', 'payment_date', 'received_by']
    list_filter   = ['payment_method', 'payment_date']
    search_fields = ['student__roll_number']


@admin.register(Fine)
class FineAdmin(admin.ModelAdmin):
    list_display  = ['student', 'amount', 'status', 'issued_at', 'waived_by']
    list_filter   = ['status']
    search_fields = ['student__roll_number']


@admin.register(MessOff)
class MessOffAdmin(admin.ModelAdmin):
    list_display  = ['student', 'from_date', 'to_date', 'status', 'requested_at', 'reviewed_by']
    list_filter   = ['status']
    search_fields = ['student__roll_number', 'student__user__full_name']

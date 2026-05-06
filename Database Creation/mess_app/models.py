from django.db import models
from django.contrib.auth.models import User

# 1. STUDENTS (linked to built-in User table)
class Student(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    student_id = models.CharField(max_length=50, unique=True)
    hostel_room = models.CharField(max_length=50, blank=True)
    mess_active = models.BooleanField(default=True)

# 2. MESS_LOGS (Check-ins)
class MessLog(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    timestamp = models.DateTimeField(auto_now_add=True)
    meal_type = models.CharField(max_length=20) # Breakfast, Lunch, Dinner

# 3. MEAL_RATES (Pricing)
class MealRate(models.Model):
    meal_type = models.CharField(max_length=20, unique=True)
    rate = models.DecimalField(max_digits=10, decimal_places=2)

# 4. MONTHLY_BILLS
class MonthlyBill(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    month = models.DateField()
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    is_paid = models.BooleanField(default=False)

# 5. PAYMENTS
class Payment(models.Model):
    bill = models.ForeignKey(MonthlyBill, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_date = models.DateTimeField(auto_now_add=True)

# 6. FINES
class Fine(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    reason = models.CharField(max_length=255)

# 7. MESS_OFF_REQUESTS
class MessOffRequest(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=20, default='Pending')

# 8. STAFF (The 8th Table)
class MessStaff(models.Model):
    name = models.CharField(max_length=100)
    role = models.CharField(max_length=50) # e.g., Cook, Manager
    shift = models.CharField(max_length=50)
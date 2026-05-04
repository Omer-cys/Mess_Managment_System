"""
URL patterns for the Mess Management API.
All routes are prefixed with /api/ from the root urls.py.
"""

from django.urls import path
from . import views

urlpatterns = [

    # ── Auth ──────────────────────────────────────────────────────────────────
    path('auth/logout/',          views.LogoutView.as_view(),         name='logout'),
    path('auth/change-password/', views.ChangePasswordView.as_view(), name='change_password'),
    path('auth/me/',              views.MeView.as_view(),             name='me'),

    # ── Users (Admin) ─────────────────────────────────────────────────────────
    path('users/',                views.UserListCreateView.as_view(), name='user_list_create'),
    path('users/<int:pk>/',       views.UserDetailView.as_view(),     name='user_detail'),

    # ── Students ──────────────────────────────────────────────────────────────
    path('students/',             views.StudentListCreateView.as_view(), name='student_list_create'),
    path('students/dashboard/',   views.StudentDashboardView.as_view(), name='student_dashboard'),
    path('students/<int:pk>/',    views.StudentDetailView.as_view(),    name='student_detail'),

    # ── Meal Rates ────────────────────────────────────────────────────────────
    path('meal-rates/',           views.MealRateListView.as_view(),   name='meal_rate_list'),

    # ── Mess Logs ─────────────────────────────────────────────────────────────
    path('mess-logs/',            views.MessLogListCreateView.as_view(), name='mess_log_list_create'),
    path('mess-logs/checkout/',   views.MessLogCheckOutView.as_view(),   name='mess_log_checkout'),

    # ── Billing ───────────────────────────────────────────────────────────────
    path('billing/generate/',     views.GenerateBillsView.as_view(),  name='generate_bills'),
    path('bills/',                views.MonthlyBillListView.as_view(), name='bill_list'),
    path('bills/<int:pk>/',       views.MonthlyBillDetailView.as_view(), name='bill_detail'),

    # ── Payments ──────────────────────────────────────────────────────────────
    path('payments/',             views.PaymentListCreateView.as_view(), name='payment_list_create'),

    # ── Fines ─────────────────────────────────────────────────────────────────
    path('fines/trigger/',        views.TriggerFinesView.as_view(), name='trigger_fines'),
    path('fines/',                views.FineListView.as_view(),     name='fine_list'),
    path('fines/waive/',          views.WaiveFineView.as_view(),    name='waive_fine'),

    # ── Mess Off ──────────────────────────────────────────────────────────────
    path('mess-off/',             views.MessOffListCreateView.as_view(), name='mess_off_list_create'),
    path('mess-off/<int:pk>/',    views.MessOffDetailView.as_view(),    name='mess_off_detail'),
    path('mess-off/<int:pk>/review/', views.ReviewMessOffView.as_view(), name='mess_off_review'),

    # ── Admin Reports ─────────────────────────────────────────────────────────
    path('admin/dashboard/',      views.AdminDashboardView.as_view(),  name='admin_dashboard'),
    path('admin/defaulters/',     views.DefaulterListView.as_view(),   name='defaulter_list'),
]

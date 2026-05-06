"""
Root URL configuration for Mess Management Backend
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from mess_management.views import LoginView

urlpatterns = [
    # Django admin panel
    path('admin/', admin.site.urls),

    # JWT Authentication endpoints
    path('api/auth/login/',   LoginView.as_view(),        name='login'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # All app API routes
    path('api/', include('mess_management.urls')),
]

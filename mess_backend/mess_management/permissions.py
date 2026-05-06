"""
Custom permission classes for role-based access control.
"""
from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """Only users with role='admin' can access this endpoint."""
    message = "You must be an admin to perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'admin'
        )


class IsStudent(BasePermission):
    """Only users with role='student' can access this endpoint."""
    message = "You must be a student to perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'student'
        )


class IsAdminOrReadOnly(BasePermission):
    """Admins can do anything. Students can only read (GET)."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        return request.user.role == 'admin'


class IsOwnerOrAdmin(BasePermission):
    """
    Object-level permission.
    Students can only access their own data. Admins can access anything.
    """
    def has_object_permission(self, request, view, obj):
        if request.user.role == 'admin':
            return True
        # Student accessing their own student profile
        if hasattr(obj, 'student'):
            return obj.student.user == request.user
        if hasattr(obj, 'user'):
            return obj.user == request.user
        return False

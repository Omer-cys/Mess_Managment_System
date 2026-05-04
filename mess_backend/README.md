# Mess Management System — Backend

Built with Django REST Framework + PostgreSQL + JWT Authentication

---

## Project Structure

```
mess_backend/
├── manage.py
├── requirements.txt
├── mess_backend/               ← Django project config
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
└── mess_management/            ← Main app
    ├── models.py               ← All 8 database tables
    ├── serializers.py          ← JSON conversion
    ├── views.py                ← All API endpoints
    ├── urls.py                 ← Route definitions
    ├── permissions.py          ← Role-based access control
    ├── billing.py              ← Billing engine
    └── admin.py                ← Django admin registration
```

---

## Step-by-Step Setup

### Step 1 — Install Python & PostgreSQL
Make sure you have:
- Python 3.10+
- PostgreSQL 14+

### Step 2 — Create the PostgreSQL Database
Open your terminal and run:
```bash
psql -U postgres
CREATE DATABASE mess_management_db;
\q
```

### Step 3 — Create a Virtual Environment
```bash
cd mess_backend
python -m venv venv

# Activate it:
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate
```

### Step 4 — Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 5 — Configure Database Credentials
Open `mess_backend/settings.py` and update:
```python
DATABASES = {
    'default': {
        'NAME':     'mess_management_db',
        'USER':     'postgres',       # your PostgreSQL username
        'PASSWORD': 'yourpassword',   # your PostgreSQL password
        'HOST':     'localhost',
        'PORT':     '5432',
    }
}
```

### Step 6 — Run Migrations (Creates all 8 tables)
```bash
python manage.py makemigrations
python manage.py migrate
```

### Step 7 — Create an Admin User
```bash
python manage.py createsuperuser
# Enter: email, full_name, password
```

### Step 8 — Start the Server
```bash
python manage.py runserver
```

Backend is now running at: http://localhost:8000

---

## API Reference

All requests require the header:
```
Authorization: Bearer <access_token>
```
Except login which is public.

---

### Authentication

| Method | URL | Description | Access |
|--------|-----|-------------|--------|
| POST | `/api/auth/login/` | Login, get tokens | Public |
| POST | `/api/auth/logout/` | Logout (blacklist token) | Any |
| POST | `/api/auth/change-password/` | Change own password | Any |
| GET | `/api/auth/me/` | Get own profile | Any |
| POST | `/api/auth/refresh/` | Refresh access token | Public |

**Login Example:**
```json
POST /api/auth/login/
{
    "email": "admin@mess.com",
    "password": "admin123"
}

Response:
{
    "access": "eyJ...",
    "refresh": "eyJ...",
    "user": { "id": 1, "email": "...", "role": "admin" }
}
```

---

### Users (Admin Only)

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/users/` | List all users |
| GET | `/api/users/?role=student` | Filter by role |
| POST | `/api/users/` | Create a user |
| GET | `/api/users/<id>/` | Get user details |
| PATCH | `/api/users/<id>/` | Update user |
| DELETE | `/api/users/<id>/` | Delete user |

---

### Students

| Method | URL | Description | Access |
|--------|-----|-------------|--------|
| GET | `/api/students/` | List all students | Admin |
| GET | `/api/students/` | Get own profile | Student |
| POST | `/api/students/` | Create student + user | Admin |
| GET | `/api/students/<id>/` | Get student details | Admin/Own |
| PATCH | `/api/students/<id>/` | Update profile | Admin/Own |
| GET | `/api/students/dashboard/` | Full dashboard | Student |

**Create Student Example:**
```json
POST /api/students/
{
    "email": "s001@university.edu",
    "full_name": "Ali Hassan",
    "password": "secure123",
    "roll_number": "CS-2021-001",
    "department": "Computer Science",
    "room_number": "A-12",
    "phone": "0300-1234567"
}
```

---

### Meal Rates

| Method | URL | Description | Access |
|--------|-----|-------------|--------|
| GET | `/api/meal-rates/` | View all rates | Any |
| POST | `/api/meal-rates/` | Set/update a rate | Admin |

**Set Rate Example:**
```json
POST /api/meal-rates/
{
    "meal_type": "lunch",
    "rate": "80.00"
}
```

---

### Mess Logs (Check-in/Check-out)

| Method | URL | Description | Access |
|--------|-----|-------------|--------|
| GET | `/api/mess-logs/` | List logs | Admin (all) / Student (own) |
| POST | `/api/mess-logs/` | Record meal check-in | Admin |
| POST | `/api/mess-logs/checkout/` | Record check-out | Admin |

**Record a Meal:**
```json
POST /api/mess-logs/
{
    "student": 3,
    "meal_type": "lunch",
    "date": "2025-06-01"
}
```

**Filter Logs:**
```
GET /api/mess-logs/?student=3&month=6&year=2025&meal_type=lunch
```

---

### Billing

| Method | URL | Description | Access |
|--------|-----|-------------|--------|
| POST | `/api/billing/generate/` | Generate bills for a month | Admin |
| GET | `/api/bills/` | List bills | Admin (all) / Student (own) |
| GET | `/api/bills/<id>/` | Bill detail | Admin/Own |

**Generate Bills:**
```json
POST /api/billing/generate/
{
    "month": 6,
    "year": 2025
}
```

---

### Payments

| Method | URL | Description | Access |
|--------|-----|-------------|--------|
| GET | `/api/payments/` | List payments | Admin (all) / Student (own) |
| POST | `/api/payments/` | Record a payment | Admin |

**Record Payment:**
```json
POST /api/payments/
{
    "bill": 5,
    "student": 3,
    "amount_paid": "500.00",
    "payment_method": "cash",
    "remarks": "Monthly bill payment"
}
```

---

### Fines

| Method | URL | Description | Access |
|--------|-----|-------------|--------|
| POST | `/api/fines/trigger/` | Run fine engine now | Admin |
| GET | `/api/fines/` | List fines | Admin (all) / Student (own) |
| POST | `/api/fines/waive/` | Waive a fine | Admin |

**Trigger Fines Manually:**
```
POST /api/fines/trigger/
(no body needed)
```

---

### Mess Off (Leave Requests)

| Method | URL | Description | Access |
|--------|-----|-------------|--------|
| GET | `/api/mess-off/` | List requests | Admin (all) / Student (own) |
| POST | `/api/mess-off/` | Submit leave request | Student |
| GET | `/api/mess-off/<id>/` | Request details | Admin/Own |
| DELETE | `/api/mess-off/<id>/` | Cancel pending request | Student/Admin |
| POST | `/api/mess-off/<id>/review/` | Approve or reject | Admin |

**Submit Leave:**
```json
POST /api/mess-off/
{
    "from_date": "2025-06-10",
    "to_date": "2025-06-15",
    "reason": "Going home for Eid"
}
```

**Admin Review:**
```json
POST /api/mess-off/3/review/
{
    "status": "approved",
    "admin_note": "Approved. Safe travels."
}
```

---

### Admin Reports

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/admin/dashboard/` | System-wide stats |
| GET | `/api/admin/defaulters/` | Students with unpaid bills |

---

## How the Billing Engine Works

1. Admin runs `POST /api/billing/generate/` with `{ month, year }`
2. The engine loops through all active students
3. For each student:
   - Fetches all mess logs for that month where `is_present=True`
   - Subtracts any approved mess-off (leave) days
   - Multiplies meal count × current meal rate
   - Saves a `MonthlyBill` record
4. Bills are due on the **10th of the next month** (configurable in settings)
5. Run `POST /api/fines/trigger/` on or after the due date to auto-fine overdue bills

---

## Django Admin Panel

Access at: http://localhost:8000/admin/
Login with your superuser credentials.
All 8 tables are visible and manageable from there.

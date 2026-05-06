-- ============================================================
-- Mess Management System - SQL Schema (Phase 1)
-- Database: mess_management_db
-- ============================================================

-- 1. USERS
-- Stores login credentials and roles for both admins and students.
CREATE TABLE Users (
    user_id     SERIAL PRIMARY KEY,
    username    VARCHAR(50)  NOT NULL UNIQUE,
    email       VARCHAR(100) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,          -- store hashed password (bcrypt / Django default)
    role        VARCHAR(10)  NOT NULL CHECK (role IN ('admin', 'student')),
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. STUDENTS
-- Extended profile for users with the 'student' role.
CREATE TABLE Students (
    student_id   SERIAL PRIMARY KEY,
    user_id      INT          NOT NULL UNIQUE REFERENCES Users(user_id) ON DELETE CASCADE,
    full_name    VARCHAR(100) NOT NULL,
    roll_number  VARCHAR(30)  NOT NULL UNIQUE,
    room_number  VARCHAR(20),
    contact      VARCHAR(15),
    joined_date  DATE         NOT NULL DEFAULT CURRENT_DATE
);

-- 3. MEAL_RATES
-- Configurable pricing per meal type, set by admins.
CREATE TABLE Meal_Rates (
    rate_id      SERIAL PRIMARY KEY,
    meal_type    VARCHAR(20)    NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snacks')),
    rate         NUMERIC(8, 2)  NOT NULL CHECK (rate >= 0),
    effective_from DATE         NOT NULL DEFAULT CURRENT_DATE,
    effective_to   DATE,                        -- NULL means currently active
    CONSTRAINT no_overlap UNIQUE (meal_type, effective_from)
);

-- 4. MESS_LOGS
-- Records every check-in / check-out event for a student's meal.
CREATE TABLE Mess_Logs (
    log_id       SERIAL PRIMARY KEY,
    student_id   INT         NOT NULL REFERENCES Students(student_id) ON DELETE CASCADE,
    meal_type    VARCHAR(20) NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snacks')),
    log_date     DATE        NOT NULL DEFAULT CURRENT_DATE,
    check_in     TIMESTAMP,
    check_out    TIMESTAMP,
    is_present   BOOLEAN     NOT NULL DEFAULT TRUE,
    CONSTRAINT unique_meal_per_day UNIQUE (student_id, meal_type, log_date)
);

-- 5. MONTHLY_BILLS
-- Auto-generated monthly bill per student based on Mess_Logs + Meal_Rates.
CREATE TABLE Monthly_Bills (
    bill_id      SERIAL PRIMARY KEY,
    student_id   INT           NOT NULL REFERENCES Students(student_id) ON DELETE CASCADE,
    bill_month   DATE          NOT NULL,        -- store as first day of the month, e.g. 2025-06-01
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    is_paid      BOOLEAN       NOT NULL DEFAULT FALSE,
    generated_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_bill_per_month UNIQUE (student_id, bill_month)
);

-- 6. PAYMENTS
-- Records every payment made against a monthly bill.
CREATE TABLE Payments (
    payment_id     SERIAL PRIMARY KEY,
    bill_id        INT           NOT NULL REFERENCES Monthly_Bills(bill_id) ON DELETE CASCADE,
    student_id     INT           NOT NULL REFERENCES Students(student_id) ON DELETE CASCADE,
    amount_paid    NUMERIC(10, 2) NOT NULL CHECK (amount_paid > 0),
    payment_date   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payment_method VARCHAR(30)   CHECK (payment_method IN ('cash', 'upi', 'card', 'bank_transfer', 'other')),
    reference_no   VARCHAR(100),               -- transaction ID / receipt number
    remarks        TEXT
);

-- 7. FINES
-- Penalty records triggered automatically for late or unpaid bills.
CREATE TABLE Fines (
    fine_id      SERIAL PRIMARY KEY,
    student_id   INT           NOT NULL REFERENCES Students(student_id) ON DELETE CASCADE,
    bill_id      INT           NOT NULL REFERENCES Monthly_Bills(bill_id) ON DELETE CASCADE,
    fine_amount  NUMERIC(8, 2) NOT NULL CHECK (fine_amount > 0),
    reason       VARCHAR(255)  NOT NULL DEFAULT 'Late payment',
    issued_on    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_paid      BOOLEAN       NOT NULL DEFAULT FALSE,
    paid_on      TIMESTAMP
);

-- 8. MESS_OFF
-- Students request leave; admins approve or reject.
CREATE TABLE Mess_Off (
    mess_off_id  SERIAL PRIMARY KEY,
    student_id   INT         NOT NULL REFERENCES Students(student_id) ON DELETE CASCADE,
    start_date   DATE        NOT NULL,
    end_date     DATE        NOT NULL,
    reason       TEXT,
    status       VARCHAR(10) NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_by  INT         REFERENCES Users(user_id) ON DELETE SET NULL,
    reviewed_at  TIMESTAMP,
    CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- ============================================================
-- INDEXES  (for common query patterns)
-- ============================================================

CREATE INDEX idx_mess_logs_student   ON Mess_Logs(student_id);
CREATE INDEX idx_mess_logs_date      ON Mess_Logs(log_date);
CREATE INDEX idx_monthly_bills_student ON Monthly_Bills(student_id);
CREATE INDEX idx_payments_bill       ON Payments(bill_id);
CREATE INDEX idx_fines_student       ON Fines(student_id);
CREATE INDEX idx_mess_off_student    ON Mess_Off(student_id);
CREATE INDEX idx_mess_off_status     ON Mess_Off(status);

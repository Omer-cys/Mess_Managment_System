import { useState, useEffect, useCallback, useRef } from "react";

// ─── Font & Global Styles ──────────────────────────────────────────────────
if (typeof document !== "undefined") {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap";
  document.head.appendChild(link);
  const s = document.createElement("style");
  s.textContent = `
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0b0d12;color:#dde1ea;font-family:'DM Sans',sans-serif;-webkit-font-smoothing:antialiased}
    ::-webkit-scrollbar{width:4px;height:4px}
    ::-webkit-scrollbar-track{background:transparent}
    ::-webkit-scrollbar-thumb{background:#252a38;border-radius:4px}
    input,select,textarea{font-family:'DM Sans',sans-serif}
    @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
    .fadeUp{animation:fadeUp .3s ease forwards}
    .spin{animation:spin .9s linear infinite}
    .pulse{animation:pulse 2s ease infinite}
    .nav-item{display:flex;align-items:center;gap:11px;padding:9px 14px;border-radius:10px;cursor:pointer;transition:all .18s;color:#636b82;font-size:13.5px;font-weight:500;border:none;background:transparent;width:100%;text-align:left}
    .nav-item:hover{background:#151821;color:#dde1ea}
    .nav-item.active{background:linear-gradient(135deg,#e89a1a,#f5b830);color:#0b0d12;font-weight:700}
    .nav-item .icon{width:18px;height:18px;flex-shrink:0}
    .card{background:#111318;border:1px solid #1c2030;border-radius:14px;padding:22px}
    .tbl-row{border-bottom:1px solid #1c2030;transition:background .15s}
    .tbl-row:hover{background:#131720}
    .tbl-row:last-child{border-bottom:none}
    .badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase}
    .b-green{background:rgba(34,197,94,.13);color:#4ade80}
    .b-red{background:rgba(239,68,68,.13);color:#f87171}
    .b-yellow{background:rgba(245,158,11,.13);color:#fbbf24}
    .b-blue{background:rgba(96,165,250,.13);color:#93c5fd}
    .b-gray{background:rgba(107,114,128,.13);color:#9ca3af}
    .b-orange{background:rgba(249,115,22,.13);color:#fb923c}
    .inp{width:100%;background:#0d0f16;border:1px solid #1c2030;border-radius:9px;padding:9px 13px;color:#dde1ea;font-family:'DM Sans',sans-serif;font-size:13.5px;outline:none;transition:border-color .18s}
    .inp:focus{border-color:#e89a1a}
    .inp::placeholder{color:#3f4558}
    .sel{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath fill='%23636b82' d='M10 14l-5-5h10z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;background-size:16px;padding-right:32px}
    .stat-card{background:#111318;border:1px solid #1c2030;border-radius:14px;padding:20px 22px;position:relative;overflow:hidden}
    .stat-card::after{content:'';position:absolute;right:-10px;top:-10px;width:70px;height:70px;border-radius:50%;opacity:.07}
    .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;z-index:1000;backdrop-filter:blur(4px)}
    .modal{background:#111318;border:1px solid #1c2030;border-radius:16px;padding:28px;width:90%;max-width:500px;max-height:90vh;overflow-y:auto}
    .tag{display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:6px;font-size:11.5px;font-weight:600}
  `;
  document.head.appendChild(s);
}

// ─── API Configuration ─────────────────────────────────────────────────────
const API_BASE = "http://localhost:8000/api";
const DEMO_MODE = false; // Set false when Django backend is running

let _token = null;

async function request(path, opts = {}) {
  if (DEMO_MODE) return null;
  try {
    const r = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(_token ? { Authorization: `Bearer ${_token}` } : {}),
        ...(opts.headers || {}),
      },
    });
    if (!r.ok) throw new Error(r.status);
    return r.json();
  } catch (e) {
    console.error("API:", path, e);
    return null;
  }
}

const API = {
  login: (e, p) => request("/auth/login/", { method: "POST", body: JSON.stringify({ email: e, password: p }) }),
  logout: () => request("/auth/logout/", { method: "POST" }),
  students: { list: () => request("/students/"), create: (d) => request("/students/", { method: "POST", body: JSON.stringify(d) }), update: (id, d) => request(`/students/${id}/`, { method: "PATCH", body: JSON.stringify(d) }), delete: (id) => request(`/students/${id}/`, { method: "DELETE" }) },
  rates: { list: () => request("/meal-rates/"), update: (id, d) => request(`/meal-rates/${id}/`, { method: "PATCH", body: JSON.stringify(d) }) },
  logs: { list: () => request("/mess-logs/"), create: (d) => request("/mess-logs/", { method: "POST", body: JSON.stringify(d) }) },
  bills: { list: () => request("/monthly-bills/"), generate: () => request("/monthly-bills/generate/", { method: "POST" }) },
  payments: { list: () => request("/payments/"), create: (d) => request("/payments/", { method: "POST", body: JSON.stringify(d) }) },
  fines: { list: () => request("/fines/"), update: (id, d) => request(`/fines/${id}/`, { method: "PATCH", body: JSON.stringify(d) }) },
  messOff: { list: () => request("/mess-off/"), update: (id, s) => request(`/mess-off/${id}/`, { method: "PATCH", body: JSON.stringify({ status: s }) }), create: (d) => request("/mess-off/", { method: "POST", body: JSON.stringify(d) }) },
};

// ─── Mock Data ─────────────────────────────────────────────────────────────
const MOCK_STUDENTS = [
  { id: 1, roll_number: "CS-2021-001", user: { full_name: "Ahmed Khan", email: "ahmed@univ.edu.pk" }, department: "CS", room_number: "A-101", status: "active", contact: "03001234567", joined_date: "2021-09-01" },
  { id: 2, roll_number: "EE-2021-002", user: { full_name: "Bilal Ahmad", email: "bilal@univ.edu.pk" }, department: "EE", room_number: "B-202", status: "active", contact: "03009876543", joined_date: "2021-09-01" },
  { id: 3, roll_number: "ME-2022-003", user: { full_name: "Zain Ullah", email: "zain@univ.edu.pk" }, department: "ME", room_number: "C-305", status: "active", contact: "03111234567", joined_date: "2022-09-01" },
  { id: 4, roll_number: "CS-2022-004", user: { full_name: "Usman Tariq", email: "usman@univ.edu.pk" }, department: "CS", room_number: "A-102", status: "inactive", contact: "03219876543", joined_date: "2022-09-01" },
  { id: 5, roll_number: "CE-2023-005", user: { full_name: "Hamza Rehman", email: "hamza@univ.edu.pk" }, department: "CE", room_number: "D-401", status: "active", contact: "03331234567", joined_date: "2023-09-01" },
  { id: 6, roll_number: "BS-2023-006", user: { full_name: "Faisal Nawaz", email: "faisal@univ.edu.pk" }, department: "BS", room_number: "B-110", status: "active", contact: "03451234567", joined_date: "2023-09-01" },
];
const MOCK_RATES = [
  { id: 1, meal_type: "breakfast", rate: 80, effective_from: "2025-01-01", updated_by: "Admin" },
  { id: 2, meal_type: "lunch", rate: 150, effective_from: "2025-01-01", updated_by: "Admin" },
  { id: 3, meal_type: "dinner", rate: 130, effective_from: "2025-01-01", updated_by: "Admin" },
  { id: 4, meal_type: "snacks", rate: 50, effective_from: "2025-01-01", updated_by: "Admin" },
];
const MOCK_LOGS = [
  { id: 1, student: { roll_number: "CS-2021-001", user: { full_name: "Ahmed Khan" } }, meal_type: "breakfast", date: "2025-05-04", check_in: "08:15", check_out: "08:45", is_present: true },
  { id: 2, student: { roll_number: "EE-2021-002", user: { full_name: "Bilal Ahmad" } }, meal_type: "lunch", date: "2025-05-04", check_in: "13:05", check_out: "13:40", is_present: true },
  { id: 3, student: { roll_number: "ME-2022-003", user: { full_name: "Zain Ullah" } }, meal_type: "dinner", date: "2025-05-03", check_in: null, check_out: null, is_present: false },
  { id: 4, student: { roll_number: "CS-2022-004", user: { full_name: "Usman Tariq" } }, meal_type: "breakfast", date: "2025-05-04", check_in: "08:30", check_out: "09:00", is_present: true },
  { id: 5, student: { roll_number: "CE-2023-005", user: { full_name: "Hamza Rehman" } }, meal_type: "snacks", date: "2025-05-04", check_in: "16:00", check_out: "16:20", is_present: true },
  { id: 6, student: { roll_number: "BS-2023-006", user: { full_name: "Faisal Nawaz" } }, meal_type: "lunch", date: "2025-05-03", check_in: "12:55", check_out: "13:30", is_present: true },
];
const MOCK_BILLS = [
  { id: 1, student: { roll_number: "CS-2021-001", user: { full_name: "Ahmed Khan" } }, month: 4, year: 2025, total_amount: 8450, paid_amount: 8450, status: "paid", due_date: "2025-05-10" },
  { id: 2, student: { roll_number: "EE-2021-002", user: { full_name: "Bilal Ahmad" } }, month: 4, year: 2025, total_amount: 7200, paid_amount: 0, status: "unpaid", due_date: "2025-05-10" },
  { id: 3, student: { roll_number: "ME-2022-003", user: { full_name: "Zain Ullah" } }, month: 4, year: 2025, total_amount: 6800, paid_amount: 3000, status: "partial", due_date: "2025-05-10" },
  { id: 4, student: { roll_number: "CS-2022-004", user: { full_name: "Usman Tariq" } }, month: 4, year: 2025, total_amount: 5500, paid_amount: 0, status: "overdue", due_date: "2025-04-30" },
  { id: 5, student: { roll_number: "CE-2023-005", user: { full_name: "Hamza Rehman" } }, month: 3, year: 2025, total_amount: 7800, paid_amount: 7800, status: "paid", due_date: "2025-04-10" },
];
const MOCK_PAYMENTS = [
  { id: 1, student: { roll_number: "CS-2021-001", user: { full_name: "Ahmed Khan" } }, amount_paid: 8450, payment_method: "bank_transfer", payment_date: "2025-05-02", received_by: "Admin", reference_no: "TXN-2025-001" },
  { id: 2, student: { roll_number: "ME-2022-003", user: { full_name: "Zain Ullah" } }, amount_paid: 3000, payment_method: "cash", payment_date: "2025-05-03", received_by: "Admin", reference_no: "CASH-001" },
  { id: 3, student: { roll_number: "CE-2023-005", user: { full_name: "Hamza Rehman" } }, amount_paid: 7800, payment_method: "upi", payment_date: "2025-04-08", received_by: "Admin", reference_no: "UPI-2025-003" },
];
const MOCK_FINES = [
  { id: 1, student: { roll_number: "CS-2022-004", user: { full_name: "Usman Tariq" } }, amount: 200, status: "unpaid", issued_at: "2025-05-01", reason: "Late payment", waived_by: null },
  { id: 2, student: { roll_number: "EE-2021-002", user: { full_name: "Bilal Ahmad" } }, amount: 150, status: "paid", issued_at: "2025-04-15", reason: "Late payment", waived_by: null },
  { id: 3, student: { roll_number: "ME-2022-003", user: { full_name: "Zain Ullah" } }, amount: 100, status: "waived", issued_at: "2025-03-10", reason: "Late payment", waived_by: "Admin" },
];
const MOCK_MESSOFF = [
  { id: 1, student: { roll_number: "CS-2021-001", user: { full_name: "Ahmed Khan" } }, from_date: "2025-05-10", to_date: "2025-05-15", status: "pending", reason: "Going home for Eid holidays", requested_at: "2025-05-03", reviewed_by: null },
  { id: 2, student: { roll_number: "EE-2021-002", user: { full_name: "Bilal Ahmad" } }, from_date: "2025-04-28", to_date: "2025-04-30", status: "approved", reason: "Family visit to Lahore", requested_at: "2025-04-25", reviewed_by: "Admin" },
  { id: 3, student: { roll_number: "ME-2022-003", user: { full_name: "Zain Ullah" } }, from_date: "2025-05-08", to_date: "2025-05-09", status: "rejected", reason: "Weekend trip with friends", requested_at: "2025-05-02", reviewed_by: "Admin" },
  { id: 4, student: { roll_number: "CE-2023-005", user: { full_name: "Hamza Rehman" } }, from_date: "2025-05-20", to_date: "2025-05-25", status: "pending", reason: "Medical appointment in Peshawar", requested_at: "2025-05-04", reviewed_by: null },
];

// ─── Utility Helpers ───────────────────────────────────────────────────────
const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtMoney = (n) => `Rs. ${Number(n).toLocaleString("en-PK")}`;
const fmtMonth = (m, y) => `${months[m - 1]} ${y}`;
const initials = (name = "") => name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const avatarBg = (name = "") => {
  const colors = ["#1d4ed8","#7c3aed","#b45309","#0f766e","#9f1239","#1e40af"];
  return colors[name.charCodeAt(0) % colors.length];
};
const mealIcon = { breakfast: "☀", lunch: "🍱", dinner: "🌙", snacks: "🍎" };

// ─── UI Primitives ─────────────────────────────────────────────────────────
function Btn({ children, variant = "primary", size = "md", onClick, className = "", disabled, type = "button" }) {
  const base = "inline-flex items-center gap-2 font-semibold rounded-lg border-none outline-none cursor-pointer transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm", lg: "px-6 py-2.5 text-sm" };
  const vars = {
    primary: "bg-gradient-to-r from-amber-500 to-yellow-400 text-gray-900 font-bold hover:opacity-90 active:scale-95",
    ghost: "bg-transparent border border-gray-700 text-gray-400 hover:border-amber-500 hover:text-amber-400",
    danger: "bg-red-600 text-white hover:bg-red-700",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
    info: "bg-blue-700 text-white hover:bg-blue-800",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${sizes[size]} ${vars[variant]} ${className}`} style={{ fontFamily: "'DM Sans',sans-serif" }}>
      {children}
    </button>
  );
}

function Avatar({ name, size = 36 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: avatarBg(name), display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 700, color: "#fff", flexShrink: 0, fontFamily: "'Syne',sans-serif" }}>
      {initials(name)}
    </div>
  );
}

function Badge({ children, color = "gray" }) {
  return <span className={`badge b-${color}`}>{children}</span>;
}

function StatusBadge({ status }) {
  const map = { active: ["green","Active"], inactive: ["gray","Inactive"], paid: ["green","Paid"], unpaid: ["red","Unpaid"], partial: ["yellow","Partial"], overdue: ["orange","Overdue"], pending: ["yellow","Pending"], approved: ["green","Approved"], rejected: ["red","Rejected"], waived: ["blue","Waived"] };
  const [c, l] = map[status] || ["gray", status];
  return <Badge color={c}>{l}</Badge>;
}

function Spinner() {
  return <div className="spin" style={{ width: 20, height: 20, border: "2px solid #252a38", borderTopColor: "#e89a1a", borderRadius: "50%" }} />;
}

function SearchBar({ value, onChange, placeholder = "Search..." }) {
  return (
    <div style={{ position: "relative" }}>
      <svg style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#4b5563" }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input className="inp" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ paddingLeft: 34, width: 240 }} />
    </div>
  );
}

function EmptyState({ message = "No data found" }) {
  return (
    <div style={{ padding: "48px 24px", textAlign: "center", color: "#4b5563" }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
      <p style={{ fontSize: 14 }}>{message}</p>
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal fadeUp" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16, color: "#dde1ea" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#636b82", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Table({ headers, children, empty }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#4b5563", letterSpacing: ".7px", textTransform: "uppercase", borderBottom: "1px solid #1c2030", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty && <EmptyState />}
    </div>
  );
}

function Td({ children, mono }) {
  return (
    <td style={{ padding: "12px 14px", fontSize: 13.5, color: "#c4c9d8", fontFamily: mono ? "'JetBrains Mono',monospace" : undefined, whiteSpace: "nowrap" }}>
      {children}
    </td>
  );
}

// ─── Sidebar ───────────────────────────────────────────────────────────────
const NAV_ADMIN = [
  { id: "overview", label: "Overview", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { id: "students", label: "Students", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
  { id: "meal-rates", label: "Meal Rates", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { id: "mess-logs", label: "Mess Logs", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  { id: "bills", label: "Monthly Bills", icon: "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" },
  { id: "payments", label: "Payments", icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
  { id: "fines", label: "Fines", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" },
  { id: "mess-off", label: "Mess Off", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
];
const NAV_STUDENT = [
  { id: "my-overview", label: "My Overview", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { id: "my-logs", label: "My Mess Logs", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  { id: "my-bills", label: "My Bills", icon: "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" },
  { id: "my-messoff", label: "Mess Off Requests", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
];

function NavIcon({ path }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

function Sidebar({ nav, active, onSelect, user, onLogout }) {
  return (
    <div style={{ width: 220, minHeight: "100vh", background: "#0d0f16", borderRight: "1px solid #1c2030", display: "flex", flexDirection: "column", padding: "0 10px", position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 10 }}>
      <div style={{ padding: "24px 8px 18px", borderBottom: "1px solid #1c2030" }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18, color: "#e89a1a", letterSpacing: -.3 }}>🍽 MessHub</div>
        <div style={{ fontSize: 11, color: "#3f4558", marginTop: 2, fontWeight: 500 }}>Management System</div>
      </div>
      <nav style={{ flex: 1, paddingTop: 12, display: "flex", flexDirection: "column", gap: 2 }}>
        {nav.map((item) => (
          <button key={item.id} className={`nav-item ${active === item.id ? "active" : ""}`} onClick={() => onSelect(item.id)}>
            <NavIcon path={item.icon} />
            {item.label}
          </button>
        ))}
      </nav>
      <div style={{ padding: "16px 8px", borderTop: "1px solid #1c2030" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <Avatar name={user?.full_name || "User"} size={32} />
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#dde1ea", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.full_name}</div>
            <div style={{ fontSize: 11, color: "#4b5563", textTransform: "capitalize" }}>{user?.role}</div>
          </div>
        </div>
        <button className="nav-item" style={{ color: "#ef4444", width: "100%" }} onClick={onLogout}>
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
          Logout
        </button>
      </div>
    </div>
  );
}

// ─── Page: Login ───────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [role, setRole] = useState("admin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    // Demo login logic
    await new Promise((r) => setTimeout(r, 700));
    if (email && pass) {
      const user = role === "admin"
        ? { id: 0, email, full_name: "Admin User", role: "admin" }
        : { id: 1, email, full_name: "Ahmed Khan", role: "student", roll_number: "CS-2021-001" };
      onLogin(user);
    } else {
      setError("Please enter email and password.");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0b0d12", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, position: "relative", overflow: "hidden" }}>
      {/* background decoration */}
      <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(232,154,26,.07) 0%, transparent 70%)", top: -100, right: -100, pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,.05) 0%, transparent 70%)", bottom: -80, left: -80, pointerEvents: "none" }} />
      <div className="fadeUp" style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 42, marginBottom: 8 }}>🍽</div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 28, color: "#e89a1a" }}>MessHub</h1>
          <p style={{ color: "#636b82", fontSize: 14, marginTop: 4 }}>Hostel Mess Management System</p>
        </div>
        <div style={{ background: "#111318", border: "1px solid #1c2030", borderRadius: 16, padding: 32 }}>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 20, color: "#dde1ea", marginBottom: 6 }}>Welcome back</h2>
          <p style={{ color: "#636b82", fontSize: 13, marginBottom: 24 }}>Sign in to your account</p>
          {/* Role Toggle */}
          <div style={{ display: "flex", background: "#0d0f16", borderRadius: 10, padding: 4, marginBottom: 22 }}>
            {["admin", "student"].map((r) => (
              <button key={r} onClick={() => setRole(r)} style={{ flex: 1, padding: "8px 0", borderRadius: 7, border: "none", fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all .2s", background: role === r ? "linear-gradient(135deg,#e89a1a,#f5b830)" : "transparent", color: role === r ? "#0b0d12" : "#636b82" }}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#636b82", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".5px" }}>Email</label>
              <input className="inp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={role === "admin" ? "admin@mess.edu.pk" : "student@univ.edu.pk"} required />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#636b82", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".5px" }}>Password</label>
              <input className="inp" type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" required />
            </div>
            {error && <p style={{ color: "#f87171", fontSize: 12.5, marginBottom: 12 }}>{error}</p>}
            <button type="submit" disabled={loading} style={{ width: "100%", padding: "11px", background: "linear-gradient(135deg,#e89a1a,#f5b830)", border: "none", borderRadius: 10, fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 14, color: "#0b0d12", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? .7 : 1, transition: "opacity .2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {loading ? <><Spinner />Signing in...</> : "Sign In →"}
            </button>
          </form>
          {DEMO_MODE && (
            <div style={{ marginTop: 18, padding: "10px 14px", background: "rgba(232,154,26,.07)", border: "1px solid rgba(232,154,26,.15)", borderRadius: 9 }}>
              <p style={{ fontSize: 11.5, color: "#e89a1a", fontWeight: 600 }}>Demo Mode Active</p>
              <p style={{ fontSize: 11, color: "#7c6520", marginTop: 2 }}>Any email/password will work. Toggle Admin/Student above.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page: Overview ────────────────────────────────────────────────────────
function OverviewPage() {
  const stats = [
    { label: "Total Students", value: 6, sub: "+2 this month", color: "#e89a1a", icon: "👨‍🎓" },
    { label: "Today's Attendance", value: "80%", sub: "12/15 meals served", color: "#22c55e", icon: "✅" },
    { label: "Pending Bills", value: 3, sub: "Rs. 18,500 due", color: "#f87171", icon: "📄" },
    { label: "This Month Revenue", value: "Rs. 25,450", sub: "3 payments received", color: "#60a5fa", icon: "💰" },
  ];
  const recentActivity = [
    { action: "Payment received from Ahmed Khan", time: "2 hrs ago", type: "payment" },
    { action: "Mess Off request from Hamza Rehman", time: "5 hrs ago", type: "request" },
    { action: "Bilal Ahmad checked in for lunch", time: "Today 1:05 PM", type: "checkin" },
    { action: "Monthly bills generated for April 2025", time: "Yesterday", type: "bill" },
    { action: "Fine issued to Usman Tariq", time: "3 days ago", type: "fine" },
  ];
  const actColor = { payment: "#22c55e", request: "#fbbf24", checkin: "#60a5fa", bill: "#e89a1a", fine: "#f87171" };
  const mealSummary = [
    { meal: "Breakfast", served: 5, total: 6, rate: 80 },
    { meal: "Lunch", served: 4, total: 6, rate: 150 },
    { meal: "Dinner", served: 3, total: 6, rate: 130 },
    { meal: "Snacks", served: 2, total: 6, rate: 50 },
  ];
  return (
    <div className="fadeUp">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, color: "#dde1ea" }}>Dashboard Overview</h2>
        <p style={{ color: "#636b82", fontSize: 13, marginTop: 3 }}>Sunday, 4 May 2025 · Good morning 👋</p>
      </div>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14, marginBottom: 24 }}>
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <div style={{ fontSize: 24, marginBottom: 10 }}>{s.icon}</div>
            <div style={{ fontSize: 24, fontFamily: "'Syne',sans-serif", fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 13, color: "#dde1ea", fontWeight: 600, marginTop: 2 }}>{s.label}</div>
            <div style={{ fontSize: 12, color: "#4b5563", marginTop: 3 }}>{s.sub}</div>
          </div>
        ))}
      </div>
      {/* Two column */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Today's Meals */}
        <div className="card">
          <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, color: "#dde1ea", marginBottom: 16 }}>Today's Meal Summary</h3>
          {mealSummary.map((m) => (
            <div key={m.meal} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: "#c4c9d8" }}>{mealIcon[m.meal.toLowerCase()]} {m.meal}</span>
                <span style={{ fontSize: 12, color: "#636b82" }}>{m.served}/{m.total} · {fmtMoney(m.rate)}</span>
              </div>
              <div style={{ height: 4, background: "#1c2030", borderRadius: 4 }}>
                <div style={{ height: "100%", width: `${(m.served / m.total) * 100}%`, background: "linear-gradient(90deg,#e89a1a,#f5b830)", borderRadius: 4, transition: "width .5s ease" }} />
              </div>
            </div>
          ))}
        </div>
        {/* Recent Activity */}
        <div className="card">
          <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, color: "#dde1ea", marginBottom: 16 }}>Recent Activity</h3>
          {recentActivity.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "flex-start" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: actColor[a.type], marginTop: 5, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, color: "#c4c9d8" }}>{a.action}</div>
                <div style={{ fontSize: 11, color: "#4b5563", marginTop: 2 }}>{a.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Page: Students ────────────────────────────────────────────────────────
function StudentsPage() {
  const [students, setStudents] = useState(MOCK_STUDENTS);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", roll_number: "", department: "CS", room_number: "", contact: "" });

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    const match = s.user.full_name.toLowerCase().includes(q) || s.roll_number.toLowerCase().includes(q) || s.department.toLowerCase().includes(q);
    const st = filter === "all" || s.status === filter;
    return match && st;
  });

  const handleAdd = () => {
    if (!form.full_name || !form.roll_number) return;
    const newS = { id: students.length + 1, roll_number: form.roll_number, user: { full_name: form.full_name, email: form.email }, department: form.department, room_number: form.room_number, status: "active", contact: form.contact, joined_date: new Date().toISOString().split("T")[0] };
    setStudents([...students, newS]);
    setShowModal(false);
    setForm({ full_name: "", email: "", roll_number: "", department: "CS", room_number: "", contact: "" });
    API.students.create(newS);
  };

  const toggleStatus = (id) => {
    setStudents(students.map((s) => s.id === id ? { ...s, status: s.status === "active" ? "inactive" : "active" } : s));
  };

  return (
    <div className="fadeUp">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, color: "#dde1ea" }}>Students</h2>
          <p style={{ color: "#636b82", fontSize: 13, marginTop: 2 }}>{students.length} total · {students.filter((s) => s.status === "active").length} active</p>
        </div>
        <Btn onClick={() => setShowModal(true)}>+ Add Student</Btn>
      </div>
      <div className="card">
        <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search students..." />
          <select className="inp sel" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 130 }}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <Table headers={["#", "Student", "Roll No.", "Dept", "Room", "Contact", "Joined", "Status", "Actions"]} empty={filtered.length === 0}>
          {filtered.map((s, i) => (
            <tr key={s.id} className="tbl-row">
              <Td>{i + 1}</Td>
              <Td>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <Avatar name={s.user.full_name} size={30} />
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "#dde1ea" }}>{s.user.full_name}</div>
                    <div style={{ fontSize: 11, color: "#4b5563" }}>{s.user.email}</div>
                  </div>
                </div>
              </Td>
              <Td mono>{s.roll_number}</Td>
              <Td><span className="tag" style={{ background: "rgba(59,130,246,.12)", color: "#60a5fa" }}>{s.department}</span></Td>
              <Td mono>{s.room_number}</Td>
              <Td>{s.contact}</Td>
              <Td>{s.joined_date}</Td>
              <Td><StatusBadge status={s.status} /></Td>
              <Td>
                <Btn size="sm" variant="ghost" onClick={() => toggleStatus(s.id)}>
                  {s.status === "active" ? "Deactivate" : "Activate"}
                </Btn>
              </Td>
            </tr>
          ))}
        </Table>
      </div>
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add New Student">
        <div style={{ display: "grid", gap: 14 }}>
          {[["Full Name", "full_name", "text", "Ahmed Khan"], ["Email", "email", "email", "student@univ.edu.pk"], ["Roll Number", "roll_number", "text", "CS-2024-001"], ["Room Number", "room_number", "text", "A-101"], ["Contact", "contact", "text", "03001234567"]].map(([label, key, type, ph]) => (
            <div key={key}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#636b82", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".4px" }}>{label}</label>
              <input className="inp" type={type} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={ph} />
            </div>
          ))}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#636b82", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".4px" }}>Department</label>
            <select className="inp sel" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
              {["CS", "EE", "ME", "CE", "BS", "MA"].map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <Btn onClick={handleAdd} className="flex-1">Add Student</Btn>
            <Btn variant="ghost" onClick={() => setShowModal(false)}>Cancel</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Page: Meal Rates ──────────────────────────────────────────────────────
function MealRatesPage() {
  const [rates, setRates] = useState(MOCK_RATES);
  const [editing, setEditing] = useState(null);
  const [tempRate, setTempRate] = useState("");

  const startEdit = (r) => { setEditing(r.id); setTempRate(r.rate); };
  const saveEdit = (id) => {
    setRates(rates.map((r) => r.id === id ? { ...r, rate: Number(tempRate) } : r));
    setEditing(null);
    API.rates.update(id, { rate: Number(tempRate) });
  };

  const totalDaily = rates.reduce((s, r) => s + r.rate, 0);
  const totalMonthly = totalDaily * 30;

  return (
    <div className="fadeUp">
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, color: "#dde1ea" }}>Meal Rates</h2>
        <p style={{ color: "#636b82", fontSize: 13, marginTop: 2 }}>Configure pricing per meal type</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 14 }}>
        <div className="card">
          <Table headers={["Meal Type", "Current Rate (Rs.)", "Effective From", "Updated By", "Actions"]}>
            {rates.map((r) => (
              <tr key={r.id} className="tbl-row">
                <Td>
                  <span style={{ fontSize: 18, marginRight: 8 }}>{mealIcon[r.meal_type]}</span>
                  <span style={{ textTransform: "capitalize", fontWeight: 600, color: "#dde1ea" }}>{r.meal_type}</span>
                </Td>
                <Td>
                  {editing === r.id ? (
                    <input className="inp" type="number" value={tempRate} onChange={(e) => setTempRate(e.target.value)} style={{ width: 100 }} autoFocus />
                  ) : (
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: "#e89a1a", fontSize: 15 }}>Rs. {r.rate}</span>
                  )}
                </Td>
                <Td>{r.effective_from}</Td>
                <Td>{r.updated_by}</Td>
                <Td>
                  {editing === r.id ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <Btn size="sm" variant="success" onClick={() => saveEdit(r.id)}>Save</Btn>
                      <Btn size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Btn>
                    </div>
                  ) : (
                    <Btn size="sm" variant="ghost" onClick={() => startEdit(r)}>Edit</Btn>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        </div>
        {/* Summary */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card">
            <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13, color: "#636b82", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 14 }}>Rate Summary</h3>
            {rates.map((r) => (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: "#c4c9d8", textTransform: "capitalize" }}>{mealIcon[r.meal_type]} {r.meal_type}</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: "#dde1ea", fontWeight: 600 }}>Rs. {r.rate}</span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid #1c2030", marginTop: 12, paddingTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "#636b82", fontWeight: 600 }}>Daily Total</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: "#e89a1a" }}>Rs. {totalDaily}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontSize: 13, color: "#636b82", fontWeight: 600 }}>Monthly Est.</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: "#e89a1a" }}>Rs. {totalMonthly.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="card" style={{ background: "rgba(232,154,26,.06)", borderColor: "rgba(232,154,26,.2)" }}>
            <p style={{ fontSize: 12.5, color: "#9b7b2a", lineHeight: 1.6 }}>💡 Meal rates are applied to all students. Changes take effect immediately for new mess log entries.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page: Mess Logs ───────────────────────────────────────────────────────
function MessLogsPage() {
  const [logs, setLogs] = useState(MOCK_LOGS);
  const [search, setSearch] = useState("");
  const [mealFilter, setMealFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ roll: "", meal_type: "breakfast", date: new Date().toISOString().split("T")[0], check_in: "", check_out: "" });

  const filtered = logs.filter((l) => {
    const q = search.toLowerCase();
    const match = l.student.user.full_name.toLowerCase().includes(q) || l.student.roll_number.toLowerCase().includes(q);
    const mf = mealFilter === "all" || l.meal_type === mealFilter;
    return match && mf;
  });

  const handleAdd = () => {
    const st = MOCK_STUDENTS.find((s) => s.roll_number === form.roll);
    if (!st) return alert("Student not found");
    const newLog = { id: logs.length + 1, student: { roll_number: form.roll, user: { full_name: st.user.full_name } }, meal_type: form.meal_type, date: form.date, check_in: form.check_in, check_out: form.check_out, is_present: true };
    setLogs([newLog, ...logs]);
    setShowModal(false);
    API.logs.create(newLog);
  };

  return (
    <div className="fadeUp">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, color: "#dde1ea" }}>Mess Logs</h2>
          <p style={{ color: "#636b82", fontSize: 13, marginTop: 2 }}>Track meal check-in/check-out records</p>
        </div>
        <Btn onClick={() => setShowModal(true)}>+ Record Entry</Btn>
      </div>
      <div className="card">
        <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search student..." />
          <select className="inp sel" value={mealFilter} onChange={(e) => setMealFilter(e.target.value)} style={{ width: 140 }}>
            <option value="all">All Meals</option>
            {["breakfast","lunch","dinner","snacks"].map((m) => <option key={m} value={m} style={{ textTransform: "capitalize" }}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
          </select>
        </div>
        <Table headers={["Student", "Roll No.", "Meal", "Date", "Check In", "Check Out", "Status"]}>
          {filtered.map((l) => (
            <tr key={l.id} className="tbl-row">
              <Td>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Avatar name={l.student.user.full_name} size={28} />
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "#dde1ea" }}>{l.student.user.full_name}</span>
                </div>
              </Td>
              <Td mono>{l.student.roll_number}</Td>
              <Td>
                <span style={{ textTransform: "capitalize" }}>{mealIcon[l.meal_type]} {l.meal_type}</span>
              </Td>
              <Td>{l.date}</Td>
              <Td mono>{l.check_in || "—"}</Td>
              <Td mono>{l.check_out || "—"}</Td>
              <Td><StatusBadge status={l.is_present ? "active" : "inactive"} /></Td>
            </tr>
          ))}
        </Table>
      </div>
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Record Mess Entry">
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#636b82", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".4px" }}>Roll Number</label>
            <select className="inp sel" value={form.roll} onChange={(e) => setForm({ ...form, roll: e.target.value })}>
              <option value="">Select Student</option>
              {MOCK_STUDENTS.map((s) => <option key={s.id} value={s.roll_number}>{s.roll_number} — {s.user.full_name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#636b82", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".4px" }}>Meal Type</label>
            <select className="inp sel" value={form.meal_type} onChange={(e) => setForm({ ...form, meal_type: e.target.value })}>
              {["breakfast","lunch","dinner","snacks"].map((m) => <option key={m} value={m} style={{ textTransform: "capitalize" }}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#636b82", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".4px" }}>Date</label>
            <input className="inp" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#636b82", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".4px" }}>Check In</label>
              <input className="inp" type="time" value={form.check_in} onChange={(e) => setForm({ ...form, check_in: e.target.value })} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#636b82", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".4px" }}>Check Out</label>
              <input className="inp" type="time" value={form.check_out} onChange={(e) => setForm({ ...form, check_out: e.target.value })} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <Btn onClick={handleAdd}>Record Entry</Btn>
            <Btn variant="ghost" onClick={() => setShowModal(false)}>Cancel</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Page: Monthly Bills ───────────────────────────────────────────────────
function BillsPage() {
  const [bills, setBills] = useState(MOCK_BILLS);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = bills.filter((b) => {
    const q = search.toLowerCase();
    const match = b.student.user.full_name.toLowerCase().includes(q) || b.student.roll_number.toLowerCase().includes(q);
    const sf = filter === "all" || b.status === filter;
    return match && sf;
  });

  const totalOutstanding = bills.filter((b) => b.status !== "paid").reduce((s, b) => s + (b.total_amount - b.paid_amount), 0);

  return (
    <div className="fadeUp">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, color: "#dde1ea" }}>Monthly Bills</h2>
          <p style={{ color: "#636b82", fontSize: 13, marginTop: 2 }}>Outstanding: <span style={{ color: "#f87171", fontWeight: 700 }}>{fmtMoney(totalOutstanding)}</span></p>
        </div>
        <Btn onClick={() => alert("Bills generated! (API: POST /monthly-bills/generate/)")}>Generate Bills</Btn>
      </div>
      <div className="card">
        <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search student..." />
          <select className="inp sel" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 150 }}>
            <option value="all">All Status</option>
            {["paid","unpaid","partial","overdue"].map((s) => <option key={s} value={s} style={{ textTransform: "capitalize" }}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
        <Table headers={["Student", "Period", "Total Amount", "Paid", "Balance", "Due Date", "Status"]}>
          {filtered.map((b) => (
            <tr key={b.id} className="tbl-row">
              <Td>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Avatar name={b.student.user.full_name} size={28} />
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "#dde1ea" }}>{b.student.user.full_name}</div>
                    <div style={{ fontSize: 11, color: "#4b5563" }}>{b.student.roll_number}</div>
                  </div>
                </div>
              </Td>
              <Td>{fmtMonth(b.month, b.year)}</Td>
              <Td mono>{fmtMoney(b.total_amount)}</Td>
              <Td mono style={{ color: "#4ade80" }}>{fmtMoney(b.paid_amount)}</Td>
              <Td mono style={{ color: b.total_amount - b.paid_amount > 0 ? "#f87171" : "#4ade80" }}>{fmtMoney(b.total_amount - b.paid_amount)}</Td>
              <Td>{b.due_date}</Td>
              <Td><StatusBadge status={b.status} /></Td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  );
}

// ─── Page: Payments ────────────────────────────────────────────────────────
function PaymentsPage() {
  const [payments, setPayments] = useState(MOCK_PAYMENTS);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ roll: "", amount: "", method: "cash", reference: "", remarks: "" });

  const filtered = payments.filter((p) => {
    const q = search.toLowerCase();
    return p.student.user.full_name.toLowerCase().includes(q) || p.student.roll_number.toLowerCase().includes(q);
  });

  const methodColors = { cash: "green", bank_transfer: "blue", upi: "info", card: "yellow", other: "gray" };

  const handleAdd = () => {
    const st = MOCK_STUDENTS.find((s) => s.roll_number === form.roll);
    if (!st || !form.amount) return alert("Fill all required fields");
    const np = { id: payments.length + 1, student: { roll_number: form.roll, user: { full_name: st.user.full_name } }, amount_paid: Number(form.amount), payment_method: form.method, payment_date: new Date().toISOString().split("T")[0], received_by: "Admin", reference_no: form.reference || `MANUAL-${Date.now()}` };
    setPayments([np, ...payments]);
    setShowModal(false);
    setForm({ roll: "", amount: "", method: "cash", reference: "", remarks: "" });
    API.payments.create(np);
  };

  return (
    <div className="fadeUp">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, color: "#dde1ea" }}>Payments</h2>
          <p style={{ color: "#636b82", fontSize: 13, marginTop: 2 }}>Total collected: <span style={{ color: "#4ade80", fontWeight: 700 }}>{fmtMoney(payments.reduce((s, p) => s + p.amount_paid, 0))}</span></p>
        </div>
        <Btn onClick={() => setShowModal(true)}>+ Record Payment</Btn>
      </div>
      <div className="card">
        <div style={{ marginBottom: 18 }}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search student..." />
        </div>
        <Table headers={["Student", "Amount Paid", "Method", "Reference", "Date", "Received By"]}>
          {filtered.map((p) => (
            <tr key={p.id} className="tbl-row">
              <Td>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Avatar name={p.student.user.full_name} size={28} />
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "#dde1ea" }}>{p.student.user.full_name}</div>
                    <div style={{ fontSize: 11, color: "#4b5563" }}>{p.student.roll_number}</div>
                  </div>
                </div>
              </Td>
              <Td><span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: "#4ade80", fontSize: 14 }}>{fmtMoney(p.amount_paid)}</span></Td>
              <Td><Badge color={methodColors[p.payment_method] || "gray"}>{p.payment_method?.replace("_", " ")}</Badge></Td>
              <Td mono>{p.reference_no}</Td>
              <Td>{p.payment_date}</Td>
              <Td>{p.received_by}</Td>
            </tr>
          ))}
        </Table>
      </div>
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Record Payment">
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#636b82", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".4px" }}>Student</label>
            <select className="inp sel" value={form.roll} onChange={(e) => setForm({ ...form, roll: e.target.value })}>
              <option value="">Select Student</option>
              {MOCK_STUDENTS.map((s) => <option key={s.id} value={s.roll_number}>{s.roll_number} — {s.user.full_name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#636b82", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".4px" }}>Amount (Rs.)</label>
            <input className="inp" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="5000" />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#636b82", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".4px" }}>Payment Method</label>
            <select className="inp sel" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              {["cash","upi","card","bank_transfer","other"].map((m) => <option key={m} value={m}>{m.replace("_"," ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#636b82", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".4px" }}>Reference No.</label>
            <input className="inp" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="TXN-2025-001" />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#636b82", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".4px" }}>Remarks</label>
            <textarea className="inp" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} placeholder="Optional notes..." rows={2} style={{ resize: "vertical" }} />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <Btn onClick={handleAdd}>Record Payment</Btn>
            <Btn variant="ghost" onClick={() => setShowModal(false)}>Cancel</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Page: Fines ───────────────────────────────────────────────────────────
function FinesPage() {
  const [fines, setFines] = useState(MOCK_FINES);

  const updateStatus = (id, status) => {
    setFines(fines.map((f) => f.id === id ? { ...f, status } : f));
    API.fines.update(id, { status });
  };

  return (
    <div className="fadeUp">
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, color: "#dde1ea" }}>Fines</h2>
        <p style={{ color: "#636b82", fontSize: 13, marginTop: 2 }}>
          Total unpaid: <span style={{ color: "#f87171", fontWeight: 700 }}>{fmtMoney(fines.filter((f) => f.status === "unpaid").reduce((s, f) => s + f.amount, 0))}</span>
        </p>
      </div>
      <div className="card">
        <Table headers={["Student", "Amount", "Reason", "Issued", "Status", "Actions"]}>
          {fines.map((f) => (
            <tr key={f.id} className="tbl-row">
              <Td>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Avatar name={f.student.user.full_name} size={28} />
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "#dde1ea" }}>{f.student.user.full_name}</div>
                    <div style={{ fontSize: 11, color: "#4b5563" }}>{f.student.roll_number}</div>
                  </div>
                </div>
              </Td>
              <Td><span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: "#f87171" }}>{fmtMoney(f.amount)}</span></Td>
              <Td>{f.reason}</Td>
              <Td>{f.issued_at}</Td>
              <Td><StatusBadge status={f.status} /></Td>
              <Td>
                <div style={{ display: "flex", gap: 6 }}>
                  {f.status === "unpaid" && (
                    <>
                      <Btn size="sm" variant="success" onClick={() => updateStatus(f.id, "paid")}>Mark Paid</Btn>
                      <Btn size="sm" variant="info" onClick={() => updateStatus(f.id, "waived")}>Waive</Btn>
                    </>
                  )}
                  {f.status !== "unpaid" && <span style={{ fontSize: 12, color: "#4b5563" }}>—</span>}
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  );
}

// ─── Page: Mess Off ────────────────────────────────────────────────────────
function MessOffPage() {
  const [requests, setRequests] = useState(MOCK_MESSOFF);
  const [filter, setFilter] = useState("all");

  const update = (id, status) => {
    setRequests(requests.map((r) => r.id === id ? { ...r, status, reviewed_by: "Admin" } : r));
    API.messOff.update(id, status);
  };

  const filtered = filter === "all" ? requests : requests.filter((r) => r.status === filter);
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="fadeUp">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, color: "#dde1ea" }}>Mess Off Requests</h2>
          <p style={{ color: "#636b82", fontSize: 13, marginTop: 2 }}>
            {pendingCount > 0 ? <span style={{ color: "#fbbf24", fontWeight: 600 }}>{pendingCount} pending review</span> : "All requests reviewed"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["all","pending","approved","rejected"].map((s) => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid", fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all .18s", background: filter === s ? "linear-gradient(135deg,#e89a1a,#f5b830)" : "transparent", color: filter === s ? "#0b0d12" : "#636b82", borderColor: filter === s ? "transparent" : "#252a38", textTransform: "capitalize" }}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        {filtered.map((r) => (
          <div key={r.id} className="card" style={{ borderLeft: `3px solid ${r.status === "pending" ? "#fbbf24" : r.status === "approved" ? "#4ade80" : "#f87171"}` }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <Avatar name={r.student.user.full_name} size={40} />
                <div>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15, color: "#dde1ea" }}>{r.student.user.full_name}</div>
                  <div style={{ fontSize: 12, color: "#636b82", marginTop: 2 }}>{r.student.roll_number}</div>
                  <div style={{ marginTop: 8, display: "flex", gap: 16 }}>
                    <div><span style={{ fontSize: 11, color: "#4b5563", fontWeight: 600, textTransform: "uppercase" }}>From</span><div style={{ fontSize: 13, color: "#c4c9d8", fontWeight: 600, fontFamily: "'JetBrains Mono',monospace", marginTop: 2 }}>{r.from_date}</div></div>
                    <div><span style={{ fontSize: 11, color: "#4b5563", fontWeight: 600, textTransform: "uppercase" }}>To</span><div style={{ fontSize: 13, color: "#c4c9d8", fontWeight: 600, fontFamily: "'JetBrains Mono',monospace", marginTop: 2 }}>{r.to_date}</div></div>
                    <div><span style={{ fontSize: 11, color: "#4b5563", fontWeight: 600, textTransform: "uppercase" }}>Requested</span><div style={{ fontSize: 12, color: "#636b82", marginTop: 2 }}>{r.requested_at}</div></div>
                  </div>
                  <div style={{ marginTop: 10, padding: "8px 12px", background: "#0d0f16", borderRadius: 8, fontSize: 13, color: "#9ca3af", maxWidth: 400 }}>"{r.reason}"</div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, flexShrink: 0 }}>
                <StatusBadge status={r.status} />
                {r.status === "pending" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn size="sm" variant="success" onClick={() => update(r.id, "approved")}>✓ Approve</Btn>
                    <Btn size="sm" variant="danger" onClick={() => update(r.id, "rejected")}>✕ Reject</Btn>
                  </div>
                )}
                {r.reviewed_by && <span style={{ fontSize: 11, color: "#4b5563" }}>Reviewed by {r.reviewed_by}</span>}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <EmptyState message="No requests found" />}
      </div>
    </div>
  );
}

// ─── Student Pages ─────────────────────────────────────────────────────────
function StudentOverview({ user }) {
  const student = MOCK_STUDENTS.find((s) => s.roll_number === user.roll_number) || MOCK_STUDENTS[0];
  const bills = MOCK_BILLS.filter((b) => b.student.roll_number === student.roll_number);
  const logs = MOCK_LOGS.filter((l) => l.student.roll_number === student.roll_number);
  const pendingBill = bills.find((b) => b.status !== "paid");
  return (
    <div className="fadeUp">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, color: "#dde1ea" }}>My Dashboard</h2>
        <p style={{ color: "#636b82", fontSize: 13, marginTop: 2 }}>Welcome back, {student.user.full_name.split(" ")[0]} 👋</p>
      </div>
      {/* Profile card */}
      <div className="card" style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 18 }}>
        <Avatar name={student.user.full_name} size={56} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18, color: "#dde1ea" }}>{student.user.full_name}</div>
          <div style={{ color: "#636b82", fontSize: 13, marginTop: 2 }}>{student.user.email}</div>
          <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
            <span className="tag" style={{ background: "rgba(59,130,246,.12)", color: "#60a5fa" }}>{student.department}</span>
            <span style={{ fontSize: 12, color: "#636b82" }}>Room: <strong style={{ color: "#c4c9d8" }}>{student.room_number}</strong></span>
            <span style={{ fontSize: 12, color: "#636b82" }}>Roll: <strong style={{ color: "#c4c9d8", fontFamily: "'JetBrains Mono',monospace" }}>{student.roll_number}</strong></span>
          </div>
        </div>
        <StatusBadge status={student.status} />
      </div>
      {/* Quick stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 14 }}>
        {[
          { icon: "🍽", label: "Meals This Month", value: logs.length, color: "#e89a1a" },
          { icon: "💰", label: "Current Bill", value: pendingBill ? fmtMoney(pendingBill.total_amount - pendingBill.paid_amount) : "Paid ✓", color: pendingBill ? "#f87171" : "#4ade80" },
          { icon: "📅", label: "Joined", value: student.joined_date, color: "#60a5fa" },
          { icon: "📞", label: "Contact", value: student.contact, color: "#a78bfa" },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#636b82", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
      {/* Pending bill alert */}
      {pendingBill && (
        <div style={{ padding: "14px 18px", background: "rgba(248,113,113,.08)", border: "1px solid rgba(248,113,113,.2)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#f87171" }}>⚠ Bill Due</div>
            <div style={{ fontSize: 12.5, color: "#9b5050", marginTop: 2 }}>{fmtMonth(pendingBill.month, pendingBill.year)} · Due: {pendingBill.due_date}</div>
          </div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18, color: "#f87171" }}>{fmtMoney(pendingBill.total_amount - pendingBill.paid_amount)}</div>
        </div>
      )}
    </div>
  );
}

function StudentLogs({ user }) {
  const student = MOCK_STUDENTS.find((s) => s.roll_number === user.roll_number) || MOCK_STUDENTS[0];
  const logs = MOCK_LOGS.filter((l) => l.student.roll_number === student.roll_number);
  return (
    <div className="fadeUp">
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, color: "#dde1ea" }}>My Mess Logs</h2>
        <p style={{ color: "#636b82", fontSize: 13, marginTop: 2 }}>{logs.length} records found</p>
      </div>
      <div className="card">
        <Table headers={["Meal", "Date", "Check In", "Check Out", "Status"]} empty={logs.length === 0}>
          {logs.map((l) => (
            <tr key={l.id} className="tbl-row">
              <Td><span style={{ textTransform: "capitalize", fontWeight: 600 }}>{mealIcon[l.meal_type]} {l.meal_type}</span></Td>
              <Td>{l.date}</Td>
              <Td mono>{l.check_in || "—"}</Td>
              <Td mono>{l.check_out || "—"}</Td>
              <Td><Badge color={l.is_present ? "green" : "red"}>{l.is_present ? "Present" : "Absent"}</Badge></Td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  );
}

function StudentBills({ user }) {
  const student = MOCK_STUDENTS.find((s) => s.roll_number === user.roll_number) || MOCK_STUDENTS[0];
  const bills = MOCK_BILLS.filter((b) => b.student.roll_number === student.roll_number);
  return (
    <div className="fadeUp">
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, color: "#dde1ea" }}>My Bills</h2>
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        {bills.map((b) => (
          <div key={b.id} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16, color: "#dde1ea" }}>{fmtMonth(b.month, b.year)}</div>
              <div style={{ fontSize: 12, color: "#636b82", marginTop: 3 }}>Due: {b.due_date}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#4b5563", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px" }}>Total</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 16, color: "#dde1ea", marginTop: 3 }}>{fmtMoney(b.total_amount)}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#4b5563", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px" }}>Paid</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 16, color: "#4ade80", marginTop: 3 }}>{fmtMoney(b.paid_amount)}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#4b5563", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px" }}>Balance</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 16, color: b.total_amount - b.paid_amount > 0 ? "#f87171" : "#4ade80", marginTop: 3 }}>{fmtMoney(b.total_amount - b.paid_amount)}</div>
            </div>
            <StatusBadge status={b.status} />
          </div>
        ))}
        {bills.length === 0 && <EmptyState message="No bills found" />}
      </div>
    </div>
  );
}

function StudentMessOff({ user }) {
  const student = MOCK_STUDENTS.find((s) => s.roll_number === user.roll_number) || MOCK_STUDENTS[0];
  const [requests, setRequests] = useState(MOCK_MESSOFF.filter((r) => r.student.roll_number === student.roll_number));
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ from_date: "", to_date: "", reason: "" });

  const handleSubmit = () => {
    if (!form.from_date || !form.to_date || !form.reason) return alert("Please fill all fields");
    const nr = { id: Date.now(), student: { roll_number: student.roll_number, user: { full_name: student.user.full_name } }, from_date: form.from_date, to_date: form.to_date, status: "pending", reason: form.reason, requested_at: new Date().toISOString().split("T")[0], reviewed_by: null };
    setRequests([nr, ...requests]);
    setShowModal(false);
    setForm({ from_date: "", to_date: "", reason: "" });
    API.messOff.create(nr);
  };

  return (
    <div className="fadeUp">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, color: "#dde1ea" }}>Mess Off Requests</h2>
          <p style={{ color: "#636b82", fontSize: 13, marginTop: 2 }}>Apply for leave from mess</p>
        </div>
        <Btn onClick={() => setShowModal(true)}>+ New Request</Btn>
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        {requests.map((r) => (
          <div key={r.id} className="card" style={{ borderLeft: `3px solid ${r.status === "pending" ? "#fbbf24" : r.status === "approved" ? "#4ade80" : "#f87171"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
                  <div><span style={{ fontSize: 11, color: "#4b5563", textTransform: "uppercase", fontWeight: 600 }}>From</span><div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: "#c4c9d8", fontSize: 13, marginTop: 2 }}>{r.from_date}</div></div>
                  <div><span style={{ fontSize: 11, color: "#4b5563", textTransform: "uppercase", fontWeight: 600 }}>To</span><div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: "#c4c9d8", fontSize: 13, marginTop: 2 }}>{r.to_date}</div></div>
                </div>
                <div style={{ fontSize: 13, color: "#9ca3af", padding: "8px 12px", background: "#0d0f16", borderRadius: 8, maxWidth: 380 }}>"{r.reason}"</div>
                <div style={{ fontSize: 11, color: "#4b5563", marginTop: 8 }}>Requested: {r.requested_at}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <StatusBadge status={r.status} />
                {r.reviewed_by && <div style={{ fontSize: 11, color: "#4b5563", marginTop: 6 }}>By: {r.reviewed_by}</div>}
              </div>
            </div>
          </div>
        ))}
        {requests.length === 0 && <EmptyState message="No requests yet" />}
      </div>
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Apply for Mess Off">
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#636b82", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".4px" }}>From Date</label>
              <input className="inp" type="date" value={form.from_date} onChange={(e) => setForm({ ...form, from_date: e.target.value })} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#636b82", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".4px" }}>To Date</label>
              <input className="inp" type="date" value={form.to_date} onChange={(e) => setForm({ ...form, to_date: e.target.value })} />
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#636b82", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".4px" }}>Reason</label>
            <textarea className="inp" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Reason for mess off..." rows={3} style={{ resize: "vertical" }} />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <Btn onClick={handleSubmit}>Submit Request</Btn>
            <Btn variant="ghost" onClick={() => setShowModal(false)}>Cancel</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("overview");

  const handleLogin = (u) => {
    setUser(u);
    setPage(u.role === "admin" ? "overview" : "my-overview");
  };

  const handleLogout = () => {
    setUser(null);
    setPage("overview");
    API.logout();
  };

  if (!user) return <LoginPage onLogin={handleLogin} />;

  const isAdmin = user.role === "admin";
  const nav = isAdmin ? NAV_ADMIN : NAV_STUDENT;

  const renderPage = () => {
    if (isAdmin) {
      switch (page) {
        case "overview": return <OverviewPage />;
        case "students": return <StudentsPage />;
        case "meal-rates": return <MealRatesPage />;
        case "mess-logs": return <MessLogsPage />;
        case "bills": return <BillsPage />;
        case "payments": return <PaymentsPage />;
        case "fines": return <FinesPage />;
        case "mess-off": return <MessOffPage />;
        default: return <OverviewPage />;
      }
    } else {
      switch (page) {
        case "my-overview": return <StudentOverview user={user} />;
        case "my-logs": return <StudentLogs user={user} />;
        case "my-bills": return <StudentBills user={user} />;
        case "my-messoff": return <StudentMessOff user={user} />;
        default: return <StudentOverview user={user} />;
      }
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0b0d12" }}>
      <Sidebar nav={nav} active={page} onSelect={setPage} user={user} onLogout={handleLogout} />
      <main style={{ marginLeft: 220, flex: 1, padding: "28px 28px 48px", minHeight: "100vh" }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, paddingBottom: 18, borderBottom: "1px solid #1c2030" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {nav.filter((n) => n.id === page).map((n) => (
              <span key={n.id} style={{ fontSize: 12, color: "#e89a1a", fontWeight: 600 }}>{n.label}</span>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {DEMO_MODE && (
              <span style={{ fontSize: 11, padding: "3px 10px", background: "rgba(232,154,26,.1)", color: "#e89a1a", borderRadius: 20, fontWeight: 700, border: "1px solid rgba(232,154,26,.2)" }}>Demo Mode</span>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Avatar name={user.full_name} size={30} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#c4c9d8" }}>{user.full_name}</span>
            </div>
          </div>
        </div>
        {renderPage()}
      </main>
    </div>
  );
}

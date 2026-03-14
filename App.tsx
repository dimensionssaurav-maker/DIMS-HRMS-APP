import React, { useState, useMemo, useEffect } from 'react';
import LoginScreen from './components/LoginScreen.tsx';
import DataResetTool from './components/DataResetTool.tsx';

import { addData, getData, updateData, deleteData } from "./services/firebaseService"

import Layout from './components/Layout.tsx';
import Dashboard from './components/Dashboard.tsx';
import EmployeeManagement from './components/EmployeeManagement.tsx';
import AttendanceTracker from './components/AttendanceTracker.tsx';
import LeaveManagement from './components/LeaveManagement.tsx';
import ShiftManagement from './components/ShiftManagement.tsx';
import PayrollCalculator from './components/PayrollCalculator.tsx';
import ExpenseTracker from './components/ExpenseTracker.tsx';
import OvertimeModule from './components/OvertimeModule.tsx';
import LoanManagement from './components/LoanManagement.tsx';
import SettingsModule from './components/SettingsModule.tsx';
import EmployeeOnboarding from './components/EmployeeOnboarding.tsx';
import AIChatBot from './components/AIChatBot.tsx';
import BiometricSync from './components/BiometricSync.tsx';

import ESICReportSection from './components/ESICReportSection.tsx';
import LWFReportSection from './components/LWFReportSection.tsx';
import ExpenseReportSection from './components/ExpenseReportSection.tsx';
import YearlyExpenseReportSection from './components/YearlyExpenseReportSection.tsx';
import LoanRecoveryReportSection from './components/LoanRecoveryReportSection.tsx';
import LateReportSection from './components/LateReportSection.tsx';
import EarlyLeaveReportSection from './components/EarlyLeaveReportSection.tsx';
import LeftEmployeesReportSection from './components/LeftEmployeesReportSection.tsx';
import ServiceChargeReportSection from './components/ServiceChargeReportSection.tsx';

import { Employee, AttendanceRecord, Expense, ExpenseClaim, LeaveRequest, Shift, Loan, PayrollConfig, Holiday, SystemUser } from './types.ts';
import { AttendanceStatus, ExpenseCategory } from './enums';
import { calculateMonthlyPayroll } from './utils/calculations.ts';

const ReportsModule = ({ employees, payroll, expenses, loans, attendance, shifts }: { 
  employees: Employee[], payroll: any[], expenses: Expense[], loans: Loan[], attendance: AttendanceRecord[], shifts: Shift[] 
}) => {
  const [reportType, setReportType] = useState('esic');
  const [year] = useState(new Date().getFullYear());
  const [month] = useState(new Date().toLocaleString('default', { month: 'long' }));
  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-100">
        {[
          { id: 'esic', label: 'ESIC Register' },
          { id: 'lwf', label: 'LWF Report' },
          { id: 'expense', label: 'Expense Analysis' },
          { id: 'loans', label: 'Loan Recovery' },
          { id: 'late', label: 'Late Arrivals' },
          { id: 'early', label: 'Early Leaving' },
          { id: 'leavers', label: 'Ex-Employees' },
            { id: 'service', label: '₹ Service Charge' }
        ].map(type => (
          <button key={type.id} onClick={() => setReportType(type.id)}
            className={`px-4 py-2 rounded-xl text-sm font-bold uppercase whitespace-nowrap transition-all ${reportType === type.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'}`}>
            {type.label}
          </button>
        ))}
      </div>
      {reportType === 'esic' && <ESICReportSection payroll={payroll} employees={employees} year={year} month={month} departmentFilter="All Departments" />}
      {reportType === 'lwf' && <LWFReportSection payroll={payroll} employees={employees} year={year} month={month} departmentFilter="All Departments" />}
      {reportType === 'expense' && (<div className="space-y-6"><ExpenseReportSection expenses={expenses} month={month} year={year} /><YearlyExpenseReportSection expenses={expenses} year={year} /></div>)}
      {reportType === 'loans' && <LoanRecoveryReportSection loans={loans} employees={employees} />}
      {reportType === 'late' && <LateReportSection employees={employees} attendance={attendance} shifts={shifts} startDate={`${year}-01-01`} endDate={`${year}-12-31`} />}
      {reportType === 'early' && <EarlyLeaveReportSection employees={employees} attendance={attendance} shifts={shifts} startDate={`${year}-01-01`} endDate={`${year}-12-31`} />}
      {reportType === 'leavers' && <LeftEmployeesReportSection employees={employees} />}
      {reportType === 'service' && <ServiceChargeReportSection payroll={payroll} employees={employees} year={year} month={month} />}
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [expenses] = useState<Expense[]>([]);
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [securityData, setSecurityData] = useState<{permissions: any[], securityConfig: any} | undefined>(undefined);
  const [users, setUsers] = useState<SystemUser[]>([
    { id: 'u1', name: 'Admin User',    email: 'admin@dims.com',    role: 'Admin',    status: 'Active', lastLogin: 'Never', isLocked: false, password: 'admin123' },
    { id: 'u2', name: 'HR Manager',    email: 'hr@dims.com',       role: 'HR',       status: 'Active', lastLogin: 'Never', isLocked: false, password: 'hr123' },
    { id: 'u3', name: 'Factory Manager', email: 'manager@dims.com', role: 'Manager', status: 'Active', lastLogin: 'Never', isLocked: false, password: 'manager123' },
    { id: 'u4', name: 'Employee',      email: 'emp@dims.com',      role: 'Employee', status: 'Active', lastLogin: 'Never', isLocked: false, password: 'emp123' },
  ]);
  // Persist login across refresh using sessionStorage
  const [showResetTool, setShowResetTool] = useState(false);
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(() => {
    try {
      const saved = sessionStorage.getItem('dims_current_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const handleLogin = (user: SystemUser) => {
    setCurrentUser(user);
    try { sessionStorage.setItem('dims_current_user', JSON.stringify(user)); } catch {}
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try { sessionStorage.removeItem('dims_current_user'); } catch {}
  };
  const [payrollConfig, setPayrollConfig] = useState<PayrollConfig>({
    globalOtMultiplier: 1.5,
    designationOverrides: {},
    foodingConfig: { enabled: true, minHours: 4, amount: 50, departmentOverrides: {} },
    attendanceConfig: { lateRules: [], earlyExitRules: [] },
    otConfig: { enabled: false, rules: [] },
    recruitmentConfig: { sources: ['LinkedIn', 'Referral', 'Agency'], serviceChargeRates: [0.0833, 0.10] }
  });

  // Load ALL collections from Firebase ONCE on mount
  useEffect(() => {
    const loadAll = async () => {
      try {
        const [emps, att, leavs, shfts, lns, clms, settingsDocs, usersDocs, deptDocs, holDocs, secDocs] = await Promise.all([
          getData("employees"),
          getData("attendance"),
          getData("leaves"),
          getData("shifts"),
          getData("loans"),
          getData("claims"),
          getData("settings"),
          getData("systemUsers"),
          getData("departments"),
          getData("holidays"),
          getData("security"),
        ]);
        const empList: Employee[] = Array.isArray(emps) ? emps as Employee[] : [];
        const attList: any[] = Array.isArray(att) ? att : [];

        // ── Auto-create employees from biometric attendance data ──────────────
        // If biometric sync added attendance records with empCode/empName,
        // auto-generate Employee records so the attendance tab can display them.
        if (attList.length > 0) {
          const existingCodes = new Set(empList.map(e => e.employeeCode || e.id));
          const newEmpsMap: Record<string, Employee> = {};

          for (const rec of attList) {
            const code = rec.empCode || rec.employeeCode || '';
            const name = rec.empName || rec.employeeName || rec.name || '';
            if (!code || existingCodes.has(code) || newEmpsMap[code]) continue;
            newEmpsMap[code] = {
              id:           rec.id || code,
              employeeCode: code,
              name:         name || `Employee ${code}`,
              designation:  '',
              department:   '',
              status:       'Active',
              joiningDate:  '',
              salary:       0,
              phone:        '',
              email:        '',
              address:      '',
              bankAccount:  '',
              ifsc:         '',
              bankName:     '',
              pan:          '',
              aadhar:       '',
              gender:       'Male',
              dob:          '',
              pfNumber:     '',
              esiNumber:    '',
              emergencyContact: '',
            } as Employee;
          }
          const autoEmps = Object.values(newEmpsMap);
          if (autoEmps.length > 0) {
            // Save auto-created employees to Firebase so they persist
            for (const emp of autoEmps) {
              try { await addData('employees', emp); } catch {}
            }
            empList.push(...autoEmps);
          }
        }

        // ── Build empCode → Firebase ID lookup map ───────────────────────────
        // Employees have random Firebase IDs. Biometric records use empCode.
        // We match them by employeeCode field.
        const empCodeToId: Record<string, string> = {};
        empList.forEach(emp => {
          const code = emp.employeeCode || emp.id;
          empCodeToId[code] = emp.id;
        });

        // ── Fix attendance: map empCode → correct employeeId + normalize status ──
        // Use string literals to avoid enum TDZ issue in minified Vite build
        // AttendanceStatus enum values: PRESENT, ABSENT, HOLIDAY, LEAVE
        const normalizeStatus = (s: string): AttendanceStatus => {
          const v = String(s || '').toUpperCase().trim();
          if (v === 'P' || v.startsWith('P/') || v === 'PRESENT') return 'PRESENT' as AttendanceStatus;
          if (v === 'A' || v === 'ABSENT')                         return 'ABSENT'  as AttendanceStatus;
          if (v === 'H' || v === 'WO' || v === 'HOLIDAY')          return 'HOLIDAY' as AttendanceStatus;
          if (v === 'L' || v === 'LEAVE')                          return 'LEAVE'   as AttendanceStatus;
          return 'PRESENT' as AttendanceStatus; // default
        };

        // Deduplicate attendance on load: keep only the LATEST record per employeeId+date
        // (duplicates were created by the old always-addData bug)
        const rawAtt: any[] = attList.map((rec: any) => {
          const empCode    = rec.empCode || rec.employeeCode || rec.employeeId || '';
          const employeeId = empCodeToId[empCode] || empCode;
          return {
            ...rec,
            employeeId,
            docId:    rec.id,   // preserve Firestore doc ID for future upserts
            checkIn:  rec.checkIn  || rec.punchIn  || '',
            checkOut: rec.checkOut || rec.punchOut || '',
            status:   normalizeStatus(rec.status),
          };
        });
        // Deduplicate: keep last record per employeeId+date (most recently added wins)
        const attMap = new Map<string, any>();
        for (const rec of rawAtt) {
          attMap.set(`${rec.employeeId}-${rec.date}`, rec);
        }
        const fixedAtt: AttendanceRecord[] = Array.from(attMap.values()) as AttendanceRecord[];

        setEmployees(empList);
        setAttendanceRecords(fixedAtt);
        setLeaveRequests(Array.isArray(leavs) ? leavs as LeaveRequest[] : []);
        setShifts(Array.isArray(shfts) ? shfts as Shift[] : []);
        setLoans(Array.isArray(lns) ? lns as Loan[] : []);
        setClaims(Array.isArray(clms) ? clms as ExpenseClaim[] : []);

        // Load payroll config — cache firebase doc ID for future updates
        if (Array.isArray(settingsDocs) && settingsDocs.length > 0) {
          const cfg = settingsDocs[0] as any; // single doc
          if (cfg) {
            const { id, ...rest } = cfg;
            settingsDocId.current = id; // cache for upsert
            setPayrollConfig(prev => ({ ...prev, ...rest }));
          }
        }
        // Load system users
        if (Array.isArray(usersDocs) && usersDocs.length > 0) {
          setUsers(usersDocs as SystemUser[]);
        }
        // Load departments — cache firebase doc ID
        if (Array.isArray(deptDocs) && deptDocs.length > 0) {
          const d = deptDocs[0] as any;
          if (d) {
            deptsDocId.current = d.id;
            if (Array.isArray(d.list)) setDepartments(d.list);
          }
        }
        // Load holidays
        if (Array.isArray(holDocs) && holDocs.length > 0) {
          setHolidays(holDocs as Holiday[]);
        }
        // Load security permissions
        if (Array.isArray(secDocs) && secDocs.length > 0) {
          const sec = secDocs[0] as any;
          securityDocId.current = sec.id;
          const { id, ...rest } = sec;
          setSecurityData(rest);
        }
      } catch (error) {
        console.error("Firebase load error:", error);
      }
    };
    loadAll();
  }, []);

  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString('default', { month: 'long' }));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [otStartDate, setOtStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [otEndDate, setOtEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [cachedInsights, setCachedInsights] = useState("");

  const payrollData = useMemo(() => employees.map(emp => 
    calculateMonthlyPayroll(emp, attendanceRecords, loans, claims, holidays, selectedMonth, selectedYear, payrollConfig)
  ), [employees, attendanceRecords, loans, claims, holidays, selectedMonth, selectedYear, payrollConfig]);

  const allExpenses = useMemo(() => {
    const claimExpenses = claims
      .filter(c => c.status === 'Approved' || c.status === 'Reimbursed')
      .map(c => ({ id: c.id, amount: c.amount, category: 'Miscellaneous', date: c.date, description: c.title } as Expense));
    return [...expenses, ...claimExpenses];
  }, [expenses, claims]);

  const appContext = {
    employees,
    attendanceSummary: attendanceRecords.length,
    payrollTotal: payrollData.reduce((sum, p) => sum + p.netPayable, 0),
    pendingClaims: claims.filter(c => c.status === 'Under Review').length
  };

  // ── EMPLOYEE handlers ──────────────────────────────────────────────────
  const handleAddEmployee = async (emp: Employee) => {
    try {
      const empRef = await addData("employees", emp);
      const savedEmp = { ...emp, id: empRef.id };
      setEmployees(prev => [...prev, savedEmp]);
      setShowOnboarding(false);
    } catch (e) { console.error("Save employee error:", e); }
  };
  const handleUpdateEmployees = async (updatedEmps: Employee[]) => {
    try {
      for (const emp of updatedEmps) {
        if (emp.id) {
          // Sanitize: remove undefined fields before sending to Firebase
          const cleanEmp = Object.fromEntries(
            Object.entries(emp).filter(([_, v]) => v !== undefined)
          );
          await updateData("employees", emp.id, cleanEmp);
        }
      }
      const ids = updatedEmps.map(e => e.id);
      setEmployees(prev => prev.map(e => ids.includes(e.id) ? updatedEmps.find(u => u.id === e.id)! : e));
    } catch (e) { console.error("Update employee error:", e); }
  };
  const handleDeleteEmployees = async (ids: string[]) => {
    try {
      for (const id of ids) await deleteData("employees", id);
      setEmployees(prev => prev.filter(e => !ids.includes(e.id)));
    } catch (e) { console.error("Delete employee error:", e); }
  };
  const handleBulkAddEmployees = async (newEmps: Employee[]) => {
    try {
      const savedEmps = await Promise.all(
        newEmps.map(async (emp) => {
          // Preserve the CSV/biometric ID as employeeCode for display & attendance matching
          const empWithCode = { ...emp, employeeCode: emp.employeeCode || emp.id };
          const ref = await addData("employees", empWithCode);
          // Firebase doc ID becomes the real id used for all updates/deletes
          return { ...empWithCode, id: ref.id };
        })
      );
      setEmployees(prev => [...prev, ...savedEmps]);
    } catch (e) { console.error("Bulk add employee error:", e); }
  };

  // ── ATTENDANCE handlers ────────────────────────────────────────────────
  const handleAttendanceUpdate = async (record: AttendanceRecord) => {
    try {
      // UPSERT: update existing Firestore doc if found, create new only if not exists.
      // Always using addData() was creating duplicate records for the same employee+date.
      const existing = attendanceRecords.find(
        r => r.employeeId === record.employeeId && r.date === record.date
      );
      const existingDocId = existing ? ((existing as any).docId || existing.id) : null;
      if (existingDocId) {
        await updateData("attendance", existingDocId, record);
      } else {
        const ref = await addData("attendance", record);
        (record as any).docId = ref.id;
      }
      setAttendanceRecords(prev => {
        const idx = prev.findIndex(r => r.employeeId === record.employeeId && r.date === record.date);
        if (idx >= 0) { const n = [...prev]; n[idx] = record; return n; }
        return [...prev, record];
      });
    } catch (e) { console.error("Save attendance error:", e); }
  };
  const handleAttendanceBulkUpdate = async (newRecords: AttendanceRecord[]) => {
    try {
      // UPSERT each record: update if exists, create if new
      for (const r of newRecords) {
        const existing = attendanceRecords.find(
          ex => ex.employeeId === r.employeeId && ex.date === r.date
        );
        const existingDocId = existing ? ((existing as any).docId || existing.id) : null;
        if (existingDocId) {
          await updateData("attendance", existingDocId, r);
        } else {
          const ref = await addData("attendance", r);
          (r as any).docId = ref.id;
        }
      }
      const keys = new Set(newRecords.map(r => `${r.employeeId}-${r.date}`));
      setAttendanceRecords(prev => [...prev.filter(r => !keys.has(`${r.employeeId}-${r.date}`)), ...newRecords]);
    } catch (e) { console.error("Bulk attendance error:", e); }
  };

  // ── LEAVE handlers ─────────────────────────────────────────────────────
  const handleAddLeave = async (req: LeaveRequest) => {
    try {
      const leaveRef = await addData("leaves", req);
      setLeaveRequests(prev => [...prev, { ...req, id: leaveRef.id }]);
    } catch (e) { console.error("Save leave error:", e); }
  };
  const handleUpdateLeave = async (req: LeaveRequest) => {
    try {
      if (req.id) await updateData("leaves", req.id, req);
      setLeaveRequests(prev => prev.map(r => r.id === req.id ? req : r));
    } catch (e) { console.error("Update leave error:", e); }
  };

  // ── SHIFT handlers ─────────────────────────────────────────────────────
  const handleAddShift = async (s: Shift) => {
    try {
      const shiftRef = await addData("shifts", s);
      setShifts(prev => [...prev, { ...s, id: shiftRef.id }]);
    } catch (e) { console.error("Save shift error:", e); }
  };
  const handleUpdateShift = async (s: Shift) => {
    try {
      if (s.id) await updateData("shifts", s.id, s);
      setShifts(prev => prev.map(sh => sh.id === s.id ? s : sh));
    } catch (e) { console.error("Update shift error:", e); }
  };
  const handleDeleteShift = async (id: string) => {
    try {
      await deleteData("shifts", id);
      setShifts(prev => prev.filter(s => s.id !== id));
    } catch (e) { console.error("Delete shift error:", e); }
  };

  // ── EXPENSE / CLAIM handlers ───────────────────────────────────────────
  const handleAddClaim = async (c: ExpenseClaim) => {
    try {
      const claimRef = await addData("claims", c);
      setClaims(prev => [...prev, { ...c, id: claimRef.id }]);
    } catch (e) { console.error("Save claim error:", e); }
  };
  const handleUpdateClaim = async (c: ExpenseClaim) => {
    try {
      if (c.id) await updateData("claims", c.id, c);
      setClaims(prev => prev.map(cl => cl.id === c.id ? c : cl));
    } catch (e) { console.error("Update claim error:", e); }
  };

  // ── LOAN handlers ──────────────────────────────────────────────────────
  const handleAddLoan = async (l: Loan) => {
    try {
      const loanRef = await addData("loans", l);
      setLoans(prev => [...prev, { ...l, id: loanRef.id }]);
    } catch (e) { console.error("Save loan error:", e); }
  };
  const handleUpdateLoan = async (l: Loan) => {
    try {
      if (l.id) await updateData("loans", l.id, l);
      setLoans(prev => prev.map(loan => loan.id === l.id ? l : loan));
    } catch (e) { console.error("Update loan error:", e); }
  };
  const handleDeleteLoan = async (id: string) => {
    try {
      await deleteData("loans", id);
      setLoans(prev => prev.filter(l => l.id !== id));
    } catch (e) { console.error("Delete loan error:", e); }
  };

  // ── Settings Save Handlers ───────────────────────────────────────────
  // In-memory cache of Firebase doc IDs for singleton docs
  const settingsDocId = React.useRef<string | null>(null);
  const deptsDocId = React.useRef<string | null>(null);
  const securityDocId = React.useRef<string | null>(null);

  // ── Helper: upsert a singleton document (always safe) ────────────────
  const upsertSingleton = async (collection: string, data: object, docIdRef: React.MutableRefObject<string | null>) => {
    try {
      // If we have a cached ID, try to update directly
      if (docIdRef.current) {
        await updateData(collection, docIdRef.current, data);
        return;
      }
      // No cached ID — fetch from Firebase to find existing doc
      const existing = await getData(collection);
      if (Array.isArray(existing) && existing.length > 0) {
        const docId = (existing[0] as any).id;
        docIdRef.current = docId;
        await updateData(collection, docId, data);
      } else {
        // Truly doesn't exist yet — create it
        const ref = await addData(collection, data);
        docIdRef.current = ref.id;
      }
    } catch (e) {
      // Update failed (doc doesn't exist) — create fresh
      console.warn(`upsertSingleton: update failed for ${collection}, creating new doc`);
      const ref = await addData(collection, data);
      docIdRef.current = ref.id;
    }
  };

  const handleUpdatePayrollConfig = async (cfg: PayrollConfig) => {
    setPayrollConfig(cfg);
    try {
      await upsertSingleton("settings", cfg, settingsDocId);
    } catch (e) { console.error("Save payrollConfig error:", e); }
  };

  const handleUpdateUsers = async (updatedUsers: SystemUser[]) => {
    setUsers(updatedUsers);
    try {
      const savedUsers: SystemUser[] = [];
      for (const user of updatedUsers) {
        const clean = Object.fromEntries(Object.entries(user).filter(([_, v]) => v !== undefined));
        // If id looks like a Firebase id (not our local u1, u2...) update directly
        const isFirebaseId = user.id && !user.id.match(/^u\d{1,4}$/);
        try {
          if (isFirebaseId) {
            await updateData("systemUsers", user.id, clean);
            savedUsers.push(user);
          } else {
            // Local id — check Firebase by email first
            const existing = await getData("systemUsers");
            const found = Array.isArray(existing) ? existing.find((u: any) => u.email?.toLowerCase() === user.email?.toLowerCase()) : null;
            if (found) {
              await updateData("systemUsers", found.id, { ...clean, id: found.id });
              savedUsers.push({ ...user, id: found.id });
            } else {
              const ref = await addData("systemUsers", clean);
              savedUsers.push({ ...user, id: ref.id });
            }
          }
        } catch (e) { console.error("Save user error:", user.email, e); savedUsers.push(user); }
      }
      setUsers(savedUsers);
    } catch (e) { console.error("Save users error:", e); }
  };

  const handleUpdateDepartments = async (depts: string[]) => {
    setDepartments(depts);
    try {
      await upsertSingleton("departments", { list: depts }, deptsDocId);
    } catch (e) { console.error("Save departments error:", e); }
  };

  const handleUpdateHolidays = async (hols: Holiday[]) => {
    setHolidays(hols);
    try {
      const existing = await getData("holidays");
      const existingIds = new Set(Array.isArray(existing) ? existing.map((h: any) => h.id) : []);
      const newIds = new Set(hols.map(h => h.id));
      for (const h of hols) {
        if (!existingIds.has(h.id)) await addData("holidays", h);
      }
      if (Array.isArray(existing)) {
        for (const h of existing as any[]) {
          if (!newIds.has(h.id)) await deleteData("holidays", h.id);
        }
      }
    } catch (e) { console.error("Save holidays error:", e); }
  };

  const handleUpdateSecurity = async (data: {permissions: any[], securityConfig: any}) => {
    setSecurityData(data);
    try {
      await upsertSingleton("security", data, securityDocId);
    } catch (e) { console.error("Save security error:", e); }
  };

  // ── Role-based module access ──────────────────────────────────────────
  const ROLE_TABS: Record<string, string[]> = {
    Admin:    ['dashboard','employees','attendance','biometric','leaves','shifts','payroll','expenses','overtime','loans','statutory','reports','settings'],
    HR:       ['dashboard','employees','attendance','biometric','leaves','shifts','payroll','expenses','loans','reports'],
    Manager:  ['dashboard','employees','attendance','leaves','overtime','reports'],
    Employee: ['dashboard','attendance','leaves'],
  };
  const allowedTabs = currentUser ? (ROLE_TABS[currentUser.role] || []) : [];

  // ── Render ─────────────────────────────────────────────────────────────
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard 
            data={{ employees, attendance: attendanceRecords, payroll: payrollData, expenses: allExpenses }}
            selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
            selectedYear={selectedYear} setSelectedYear={setSelectedYear}
            months={["January","February","March","April","May","June","July","August","September","October","November","December"]}
            years={[2023,2024,2025,2026]}
            cachedInsights={cachedInsights} setCachedInsights={setCachedInsights}
          />
        );
      case 'employees':
        return showOnboarding ? (
          <EmployeeOnboarding onComplete={handleAddEmployee} onCancel={() => setShowOnboarding(false)} departments={departments} />
        ) : (
          <EmployeeManagement
            employees={employees} departments={departments} shifts={shifts} payrollConfig={payrollConfig}
            onAdd={() => setShowOnboarding(true)}
            onBulkAdd={handleBulkAddEmployees}
            onDelete={handleDeleteEmployees}
            onUpdate={handleUpdateEmployees}
          />
        );
      case 'attendance':
        return (
          <AttendanceTracker
            employees={employees.filter(e => e.status === 'Active')} shifts={shifts}
            records={attendanceRecords} holidays={holidays} payrollConfig={payrollConfig}
            onUpdate={handleAttendanceUpdate} onBulkUpdate={handleAttendanceBulkUpdate}
          />
        );
      case 'biometric':
        return (
          <div className="p-6">
            <BiometricSync
              employees={employees}
              onAttendanceSynced={(records) => {
                records.forEach(r => handleAttendanceUpdate(r));
              }}
            />
          </div>
        );
      case 'leaves':
        return (
          <LeaveManagement
            employees={employees} leaveRequests={leaveRequests} holidays={holidays}
            onAddRequest={handleAddLeave} onUpdateRequest={handleUpdateLeave} onUpdateHolidays={handleUpdateHolidays}
          />
        );
      case 'shifts':
        return (
          <ShiftManagement shifts={shifts} onAdd={handleAddShift} onUpdate={handleUpdateShift} onDelete={handleDeleteShift} />
        );
      case 'payroll':
        return <PayrollCalculator employees={employees} payroll={payrollData} loans={loans} month={selectedMonth} year={selectedYear} onMonthChange={setSelectedMonth} onYearChange={setSelectedYear} />;
      case 'expenses':
        return (
          <ExpenseTracker
            claims={claims} employees={employees} departments={departments}
            onAddClaim={handleAddClaim} onUpdateClaim={handleUpdateClaim}
          />
        );
      case 'overtime':
        return (
          <OvertimeModule
            employees={employees.filter(e => e.status === 'Active')} attendanceRecords={attendanceRecords}
            departments={departments} startDate={otStartDate} endDate={otEndDate}
            onDateChange={(s, e) => { setOtStartDate(s); setOtEndDate(e); }} payrollConfig={payrollConfig}
          />
        );
      case 'loans':
        return (
          <LoanManagement loans={loans} employees={employees} onAdd={handleAddLoan} onUpdate={handleUpdateLoan} onDelete={handleDeleteLoan} />
        );
      case 'statutory':
        return (
          <div className="space-y-8">
            <ESICReportSection payroll={payrollData} employees={employees} year={selectedYear} month={selectedMonth} departmentFilter="All Departments" />
            <LWFReportSection payroll={payrollData} employees={employees} year={selectedYear} month={selectedMonth} departmentFilter="All Departments" />
          </div>
        );
      case 'reports':
        return <ReportsModule employees={employees} payroll={payrollData} expenses={allExpenses} loans={loans} attendance={attendanceRecords} shifts={shifts} />;
      case 'settings':
        return (
          <SettingsModule
            payrollConfig={payrollConfig} onUpdatePayrollConfig={handleUpdatePayrollConfig}
            employees={employees} departments={departments}
            onUpdateDepartments={handleUpdateDepartments} users={users} onUpdateUsers={handleUpdateUsers}
            securityData={securityData} onUpdateSecurity={handleUpdateSecurity}
          />
        );
      default:
        return null;
    }
  };

  // Show login screen if not authenticated
  if (!currentUser) {
    return (
      <LoginScreen
        users={users}
        onLogin={handleLogin}
        onUpdateUsers={handleUpdateUsers}
      />
    );
  }

  return (
    <>
    {showResetTool && currentUser?.role === 'Admin' && (
      <DataResetTool
        onResetComplete={() => { setShowResetTool(false); }}
        onCancel={() => setShowResetTool(false)}
      />
    )}
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} allowedTabs={allowedTabs} currentUser={currentUser} onLogout={handleLogout} onOpenReset={currentUser?.role === 'Admin' ? () => setShowResetTool(true) : undefined}>
      <div className="animate-in fade-in duration-500">{renderContent()}</div>
      <AIChatBot appContext={appContext} />
    </Layout>
    </>
  );
}

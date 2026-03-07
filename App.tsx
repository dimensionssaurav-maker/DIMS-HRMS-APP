import React, { useState, useMemo, useEffect } from 'react';

import { addData, getData } from "./services/firebaseService"

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

// Report Components
import ESICReportSection from './components/ESICReportSection.tsx';
import LWFReportSection from './components/LWFReportSection.tsx';
import ExpenseReportSection from './components/ExpenseReportSection.tsx';
import YearlyExpenseReportSection from './components/YearlyExpenseReportSection.tsx';
import LoanRecoveryReportSection from './components/LoanRecoveryReportSection.tsx';
import LateReportSection from './components/LateReportSection.tsx';
import LeftEmployeesReportSection from './components/LeftEmployeesReportSection.tsx';

import { 
  Employee, AttendanceRecord, Expense, ExpenseClaim, LeaveRequest, 
  Shift, Loan, PayrollConfig, Holiday, ExpenseCategory, SystemUser 
} from './types.ts';
import { 
  INITIAL_EMPLOYEES, INITIAL_SHIFTS, INITIAL_CLAIMS, 
  INITIAL_LEAVES, INITIAL_LOANS, INITIAL_DEPARTMENTS 
} from './constants';
import { calculateMonthlyPayroll } from './utils/calculations.ts';

const ReportsModule = ({ 
  employees, payroll, expenses, loans, attendance, shifts 
}: { 
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
            { id: 'leavers', label: 'Ex-Employees' }
          ].map(type => (
             <button 
               key={type.id}
               onClick={() => setReportType(type.id)}
               className={`px-4 py-2 rounded-xl text-sm font-bold uppercase whitespace-nowrap transition-all ${reportType === type.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'}`}
             >
               {type.label}
             </button>
          ))}
       </div>

       {reportType === 'esic' && <ESICReportSection payroll={payroll} employees={employees} year={year} month={month} departmentFilter="All Departments" />}
       {reportType === 'lwf' && <LWFReportSection payroll={payroll} employees={employees} year={year} month={month} departmentFilter="All Departments" />}
       {reportType === 'expense' && (
          <div className="space-y-6">
            <ExpenseReportSection expenses={expenses} month={month} year={year} />
            <YearlyExpenseReportSection expenses={expenses} year={year} />
          </div>
       )}
       {reportType === 'loans' && <LoanRecoveryReportSection loans={loans} employees={employees} />}
       {reportType === 'late' && <LateReportSection employees={employees} attendance={attendance} shifts={shifts} startDate={`${year}-01-01`} endDate={`${year}-12-31`} />}
       {reportType === 'leavers' && <LeftEmployeesReportSection employees={employees} />}
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Persistent Data States
  const [employees, setEmployees] = useState<Employee[]>(
  'zenhr_employees',
  INITIAL_EMPLOYEES || []
);

useEffect(() => {

  const loadEmployees = async () => {
    try {

      const firebaseEmployees = await getData("employees");
setEmployees(firebaseEmployees as Employee[]);

          } catch (error) {
      console.error("Error loading employees:", error);
    }
  };

  loadEmployees();

}, []);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>('zenhr_attendance', []);
  useEffect(() => {

  const loadAttendance = async () => {
    const data = await getData("attendance");
    setAttendanceRecords(data as AttendanceRecord[]);
  };
// LOAD LEAVES FROM FIREBASE
useEffect(() => {

  const loadLeaves = async () => {
    const data = await getData("leaves");
    setLeaveRequests(data as LeaveRequest[]);
  };

  loadLeaves();

}, []);

// LOAD SHIFTS FROM FIREBASE
useEffect(() => {

  const loadShifts = async () => {
    const data = await getData("shifts");
    setShifts(data as Shift[]);
  };

  loadShifts();

}, []);

// LOAD LOANS FROM FIREBASE
useEffect(() => {

  const loadLoans = async () => {
    const data = await getData("loans");
    setLoans(data as Loan[]);
  };

  loadLoans();

}, []);

// LOAD CLAIMS FROM FIREBASE
useEffect(() => {

  const loadClaims = async () => {
    const data = await getData("claims");
    setClaims(data as ExpenseClaim[]);
  };

  loadClaims();

}, []);
  loadAttendance();

}, []);
  const [expenses] = useState<Expense[]>('zenhr_expenses', []); 
  const [claims, setClaims] = useState<ExpenseClaim[]>('zenhr_claims', INITIAL_CLAIMS || []);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>('zenhr_leaves', INITIAL_LEAVES || []);
  const [shifts, setShifts] = useState<Shift[]>('zenhr_shifts', INITIAL_SHIFTS || []);
  const [loans, setLoans] = useState<Loan[]>('zenhr_loans', INITIAL_LOANS || []);
  const [departments, setDepartments] = useState<string[]>('zenhr_departments', INITIAL_DEPARTMENTS || []);
  const [holidays, setHolidays] = useState<Holiday[]>('zenhr_holidays', []);
  // LOAD EMPLOYEES
useEffect(() => {
  const loadEmployees = async () => {
    try {
      const data = await getData("employees");
      setEmployees(data as Employee[]);
    } catch (error) {
      console.error("Error loading employees:", error);
    }
  };
  loadEmployees();
}, []);


// LOAD ATTENDANCE
useEffect(() => {
  const loadAttendance = async () => {
    try {
      const data = await getData("attendance");
      setAttendanceRecords(data as AttendanceRecord[]);
    } catch (error) {
      console.error("Error loading attendance:", error);
    }
  };
  loadAttendance();
}, []);


// LOAD LEAVES
useEffect(() => {
  const loadLeaves = async () => {
    try {
      const data = await getData("leaves");
      setLeaveRequests(data as LeaveRequest[]);
    } catch (error) {
      console.error("Error loading leaves:", error);
    }
  };
  loadLeaves();
}, []);


// LOAD SHIFTS
useEffect(() => {
  const loadShifts = async () => {
    try {
      const data = await getData("shifts");
      setShifts(data as Shift[]);
    } catch (error) {
      console.error("Error loading shifts:", error);
    }
  };
  loadShifts();
}, []);


// LOAD LOANS
useEffect(() => {
  const loadLoans = async () => {
    try {
      const data = await getData("loans");
      setLoans(data as Loan[]);
    } catch (error) {
      console.error("Error loading loans:", error);
    }
  };
  loadLoans();
}, []);


// LOAD CLAIMS
useEffect(() => {
  const loadClaims = async () => {
    try {
      const data = await getData("claims");
      setClaims(data as ExpenseClaim[]);
    } catch (error) {
      console.error("Error loading claims:", error);
    }
  };
  loadClaims();
}, []);
  
  // Persistent System Users
  const [users, setUsers] = useState<SystemUser[]>('zenhr_users', [
    { id: 'u1', name: 'Admin User', email: 'admin@zenhr.com', role: 'Admin', status: 'Active', lastLogin: '2024-10-25 09:00 AM', isLocked: true }
  ]);

  // Persistent Config
  const [payrollConfig, setPayrollConfig] = useState<PayrollConfig>('zenhr_payroll_config', {
    globalOtMultiplier: 1.5,
    designationOverrides: {},
    foodingConfig: { enabled: true, minHours: 4, amount: 50, departmentOverrides: {} },
    attendanceConfig: { lateRules: [], earlyExitRules: [] },
    otConfig: { enabled: false, rules: [] },
    recruitmentConfig: { sources: ['LinkedIn', 'Referral', 'Agency'], serviceChargeRates: [0.0833, 0.10] }
  });

  // Dashboard & Filter States
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString('default', { month: 'long' }));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [otStartDate, setOtStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [otEndDate, setOtEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [cachedInsights, setCachedInsights] = useState("");

  // Derived Payroll Data
  const payrollData = useMemo(() => {
    return employees.map(emp => 
        calculateMonthlyPayroll(emp, attendanceRecords, loans, claims, holidays, selectedMonth, selectedYear, payrollConfig)
    );
  }, [employees, attendanceRecords, loans, claims, holidays, selectedMonth, selectedYear, payrollConfig]);

  // Merged Expenses for Reports
  const allExpenses = useMemo(() => {
      const claimExpenses = claims
        .filter(c => c.status === 'Approved' || c.status === 'Reimbursed')
        .map(c => ({
            id: c.id,
            amount: c.amount,
            category: ExpenseCategory.MISC, 
            date: c.date,
            description: c.title
        } as Expense));
      return [...expenses, ...claimExpenses];
  }, [expenses, claims]);

  // Context for AI
  const appContext = {
    employees,
    attendanceSummary: attendanceRecords.length,
    payrollTotal: payrollData.reduce((sum, p) => sum + p.netPayable, 0),
    pendingClaims: claims.filter(c => c.status === 'Under Review').length
  };

  const handleAddEmployee = async (emp: Employee) => {
  try {
    await addData("employees", emp);

    setEmployees([...employees, emp]);
    setShowOnboarding(false);

    console.log("Employee saved to Firebase");
  } catch (error) {
    console.error("Error saving employee:", error);
  }
};

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard 
            data={{ 
              employees, 
              attendance: attendanceRecords, 
              payroll: payrollData, 
              expenses: allExpenses 
            }}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            selectedYear={selectedYear}
            setSelectedYear={setSelectedYear}
            months={["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]}
            years={[2023, 2024, 2025]}
            cachedInsights={cachedInsights}
            setCachedInsights={setCachedInsights}
          />
        );
      case 'employees':
        return showOnboarding ? (
            <EmployeeOnboarding 
              onComplete={handleAddEmployee} 
              onCancel={() => setShowOnboarding(false)} 
              departments={departments}
            />
          ) : (
            <EmployeeManagement 
              employees={employees}
              departments={departments}
              shifts={shifts}
              payrollConfig={payrollConfig}
              onAdd={() => setShowOnboarding(true)}
              onBulkAdd={(newEmps) => setEmployees([...employees, ...newEmps])}
              onDelete={(ids) => setEmployees(employees.filter(e => !ids.includes(e.id)))}
              onUpdate={(updatedEmps) => {
                 const updatedIds = updatedEmps.map(e => e.id);
                 setEmployees(employees.map(e => updatedIds.includes(e.id) ? updatedEmps.find(u => u.id === e.id)! : e));
              }}
            />
          );
      case 'attendance':
        return (
          <AttendanceTracker 
            employees={employees.filter(e => e.status === 'Active')}
            shifts={shifts}
            records={attendanceRecords}
            holidays={holidays}
            payrollConfig={payrollConfig}
            onUpdate={async (record) => {

  await addData("attendance", record)

  const existingIdx = attendanceRecords.findIndex(r => r.employeeId === record.employeeId && r.date === record.date)

  if (existingIdx >= 0) {
    const newRecords = [...attendanceRecords]
    newRecords[existingIdx] = record
    setAttendanceRecords(newRecords)
  } else {
    setAttendanceRecords([...attendanceRecords, record])
  }

}}
            onBulkUpdate={async (newRecords) => {

  for (const r of newRecords) {
    await addData("attendance", r)
  }

  const newRecordKeys = new Set(newRecords.map(r => `${r.employeeId}-${r.date}`))
  const filteredOld = attendanceRecords.filter(r => !newRecordKeys.has(`${r.employeeId}-${r.date}`))

  setAttendanceRecords([...filteredOld, ...newRecords])

}}
          />
        );
      case 'leaves':
        return (
          <LeaveManagement 
            employees={employees}
            leaveRequests={leaveRequests}
            holidays={holidays}
            onAddRequest={(req) => setLeaveRequests([...leaveRequests, req])}
            onUpdateRequest={(req) => setLeaveRequests(leaveRequests.map(r => r.id === req.id ? req : r))}
            onUpdateHolidays={setHolidays}
          />
        );
      case 'shifts':
        return (
          <ShiftManagement 
            shifts={shifts}
            onAdd={(s) => setShifts([...shifts, s])}
            onUpdate={(s) => setShifts(shifts.map(sh => sh.id === s.id ? s : sh))}
            onDelete={(id) => setShifts(shifts.filter(s => s.id !== id))}
          />
        );
      case 'payroll':
        return (
          <PayrollCalculator 
            employees={employees}
            payroll={payrollData}
            loans={loans}
            month={selectedMonth}
            year={selectedYear}
          />
        );
      case 'expenses':
        return (
          <ExpenseTracker 
            claims={claims}
            employees={employees}
            departments={departments}
            onAddClaim={(c) => setClaims([...claims, c])}
            onUpdateClaim={(c) => setClaims(claims.map(cl => cl.id === c.id ? c : cl))}
          />
        );
      case 'overtime':
        return (
          <OvertimeModule 
             employees={employees.filter(e => e.status === 'Active')}
             attendanceRecords={attendanceRecords}
             departments={departments}
             startDate={otStartDate}
             endDate={otEndDate}
             onDateChange={(s, e) => { setOtStartDate(s); setOtEndDate(e); }}
             payrollConfig={payrollConfig}
          />
        );
      case 'loans':
        return (
          <LoanManagement 
            loans={loans}
            employees={employees}
            onAdd={(l) => setLoans([...loans, l])}
            onUpdate={(l) => setLoans(loans.map(loan => loan.id === l.id ? l : loan))}
            onDelete={(id) => setLoans(loans.filter(l => l.id !== id))}
          />
        );
      case 'statutory':
        return (
           <div className="space-y-8">
              <ESICReportSection payroll={payrollData} employees={employees} year={selectedYear} month={selectedMonth} departmentFilter="All Departments" />
              <LWFReportSection payroll={payrollData} employees={employees} year={selectedYear} month={selectedMonth} departmentFilter="All Departments" />
           </div>
        );
      case 'reports':
        return (
          <ReportsModule 
            employees={employees}
            payroll={payrollData}
            expenses={allExpenses}
            loans={loans}
            attendance={attendanceRecords}
            shifts={shifts}
          />
        );
      case 'settings':
        return (
          <SettingsModule 
            payrollConfig={payrollConfig}
            onUpdatePayrollConfig={setPayrollConfig}
            employees={employees}
            departments={departments}
            onUpdateDepartments={setDepartments}
            users={users}
            onUpdateUsers={setUsers}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="animate-in fade-in duration-500">
        {renderContent()}
      </div>
      <AIChatBot appContext={appContext} />
    </Layout>
  );
}

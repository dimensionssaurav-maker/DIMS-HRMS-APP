import React, { useState, useMemo, useEffect } from "react";
import { addData, getData } from "./services/firebaseService";

import Layout from "./components/Layout.tsx";
import Dashboard from "./components/Dashboard.tsx";
import EmployeeManagement from "./components/EmployeeManagement.tsx";
import AttendanceTracker from "./components/AttendanceTracker.tsx";
import LeaveManagement from "./components/LeaveManagement.tsx";
import ShiftManagement from "./components/ShiftManagement.tsx";
import PayrollCalculator from "./components/PayrollCalculator.tsx";
import ExpenseTracker from "./components/ExpenseTracker.tsx";
import OvertimeModule from "./components/OvertimeModule.tsx";
import LoanManagement from "./components/LoanManagement.tsx";
import SettingsModule from "./components/SettingsModule.tsx";
import EmployeeOnboarding from "./components/EmployeeOnboarding.tsx";
import AIChatBot from "./components/AIChatBot.tsx";

import {
  Employee,
  AttendanceRecord,
  ExpenseClaim,
  LeaveRequest,
  Shift,
  Loan,
  PayrollConfig,
  Holiday,
  SystemUser,
} from "./types.ts";

import { calculateMonthlyPayroll } from "./utils/calculations.ts";

export default function App() {

  const [activeTab, setActiveTab] = useState("dashboard");
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);

  const [payrollConfig, setPayrollConfig] = useState<PayrollConfig>({
    globalOtMultiplier: 1.5,
    designationOverrides: {},
    foodingConfig: { enabled: true, minHours: 4, amount: 50, departmentOverrides: {} },
    attendanceConfig: { lateRules: [], earlyExitRules: [] },
    otConfig: { enabled: false, rules: [] },
    recruitmentConfig: { sources: [], serviceChargeRates: [] }
  });

  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toLocaleString("default", { month: "long" })
  );

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [cachedInsights, setCachedInsights] = useState("");

  const [otStartDate, setOtStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [otEndDate, setOtEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // 🔥 LOAD ALL DATA FROM FIREBASE
  useEffect(() => {

    const loadAllData = async () => {

      try {

        const emp = await getData("employees");
        setEmployees(Array.isArray(emp) ? emp : []);

        const att = await getData("attendance");
        setAttendanceRecords(Array.isArray(att) ? att : []);

        const lev = await getData("leaves");
        setLeaveRequests(Array.isArray(lev) ? lev : []);

        const sh = await getData("shifts");
        setShifts(Array.isArray(sh) ? sh : []);

        const ln = await getData("loans");
        setLoans(Array.isArray(ln) ? ln : []);

        const cl = await getData("claims");
        setClaims(Array.isArray(cl) ? cl : []);

      } catch (err) {

        console.error("Firebase load error:", err);

      }

    };

    loadAllData();

  }, []);

  // Payroll calculation
  const payrollData = useMemo(() => {

    return employees.map(emp =>
      calculateMonthlyPayroll(
        emp,
        attendanceRecords,
        loans,
        claims,
        holidays,
        selectedMonth,
        selectedYear,
        payrollConfig
      )
    );

  }, [
    employees,
    attendanceRecords,
    loans,
    claims,
    holidays,
    selectedMonth,
    selectedYear,
    payrollConfig
  ]);

  // Add Employee
  const handleAddEmployee = async (emp: Employee) => {

    await addData("employees", emp);

    setEmployees([...employees, emp]);

    setShowOnboarding(false);

  };

  const renderContent = () => {

    switch (activeTab) {

      case "dashboard":
        return (
          <Dashboard
            data={{
              employees,
              attendance: attendanceRecords,
              payroll: payrollData,
              expenses: []
            }}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            selectedYear={selectedYear}
            setSelectedYear={setSelectedYear}
            cachedInsights={cachedInsights}
            setCachedInsights={setCachedInsights}
          />
        );

      case "employees":
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
            onBulkAdd={(e) => setEmployees([...employees, ...e])}
            onDelete={(ids) =>
              setEmployees(employees.filter(e => !ids.includes(e.id)))
            }
            onUpdate={(updated) =>
              setEmployees(
                employees.map(e =>
                  updated.find(u => u.id === e.id) || e
                )
              )
            }
          />
        );

      case "attendance":
        return (
          <AttendanceTracker
            employees={employees.filter(e => e.status === "Active")}
            shifts={shifts}
            records={attendanceRecords}
            holidays={holidays}
            payrollConfig={payrollConfig}
            onUpdate={async (record) => {

              await addData("attendance", record);

              setAttendanceRecords([...attendanceRecords, record]);

            }}
            onBulkUpdate={async (records) => {

              for (const r of records) {
                await addData("attendance", r);
              }

              setAttendanceRecords([...attendanceRecords, ...records]);

            }}
          />
        );

      case "leaves":
        return (
          <LeaveManagement
            employees={employees}
            leaveRequests={leaveRequests}
            holidays={holidays}
            onAddRequest={(r) => setLeaveRequests([...leaveRequests, r])}
            onUpdateRequest={(r) =>
              setLeaveRequests(
                leaveRequests.map(l => (l.id === r.id ? r : l))
              )
            }
            onUpdateHolidays={setHolidays}
          />
        );

      case "shifts":
        return (
          <ShiftManagement
            shifts={shifts}
            onAdd={(s) => setShifts([...shifts, s])}
            onUpdate={(s) =>
              setShifts(shifts.map(sh => (sh.id === s.id ? s : sh)))
            }
            onDelete={(id) =>
              setShifts(shifts.filter(s => s.id !== id))
            }
          />
        );

      case "loans":
        return (
          <LoanManagement
            loans={loans}
            employees={employees}
            onAdd={(l) => setLoans([...loans, l])}
            onUpdate={(l) =>
              setLoans(loans.map(lo => (lo.id === l.id ? l : lo)))
            }
            onDelete={(id) =>
              setLoans(loans.filter(l => l.id !== id))
            }
          />
        );

      case "settings":
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
      {renderContent()}
      <AIChatBot appContext={{ employees }} />
    </Layout>
  );

}

import React, { useState, useEffect, useMemo } from "react";
import { addData, getData } from "./services/firebaseService";

import Layout from "./components/Layout";
import Dashboard from "./components/Dashboard";
import EmployeeManagement from "./components/EmployeeManagement";
import AttendanceTracker from "./components/AttendanceTracker";
import LeaveManagement from "./components/LeaveManagement";
import ShiftManagement from "./components/ShiftManagement";
import PayrollCalculator from "./components/PayrollCalculator";
import ExpenseTracker from "./components/ExpenseTracker";
import OvertimeModule from "./components/OvertimeModule";
import LoanManagement from "./components/LoanManagement";
import SettingsModule from "./components/SettingsModule";
import EmployeeOnboarding from "./components/EmployeeOnboarding";
import AIChatBot from "./components/AIChatBot";

import {
  Employee,
  AttendanceRecord,
  ExpenseClaim,
  LeaveRequest,
  Shift,
  Loan,
  PayrollConfig,
  Holiday,
  SystemUser
} from "./types";

import { calculateMonthlyPayroll } from "./utils/calculations";

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

  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toLocaleString("default", { month: "long" })
  );

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [payrollConfig, setPayrollConfig] = useState<PayrollConfig>({
    globalOtMultiplier: 1.5,
    designationOverrides: {},
    foodingConfig: { enabled: true, minHours: 4, amount: 50, departmentOverrides: {} },
    attendanceConfig: { lateRules: [], earlyExitRules: [] },
    otConfig: { enabled: false, rules: [] },
    recruitmentConfig: { sources: [], serviceChargeRates: [] }
  });

  const [cachedInsights, setCachedInsights] = useState("");

  const [otStartDate, setOtStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [otEndDate, setOtEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  /* ===============================
     LOAD ALL FIREBASE DATA
  =============================== */

  useEffect(() => {

    const loadData = async () => {

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

        console.error("Firebase loading error:", err);

      }

    };

    loadData();

  }, []);

  /* ===============================
     PAYROLL CALCULATION
  =============================== */

  const payrollData = useMemo(() => {

    const safeEmployees = Array.isArray(employees) ? employees : [];

    return safeEmployees.map(emp =>
      calculateMonthlyPayroll(
        emp,
        attendanceRecords || [],
        loans || [],
        claims || [],
        holidays || [],
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

  /* ===============================
     ADD EMPLOYEE
  =============================== */

  const handleAddEmployee = async (emp: Employee) => {

    try {

      await addData("employees", emp);

      setEmployees(prev => [...prev, emp]);

      setShowOnboarding(false);

    } catch (err) {

      console.error("Employee save error:", err);

    }

  };

  /* ===============================
     RENDER MODULE
  =============================== */

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
            onBulkAdd={(list) => setEmployees(prev => [...prev, ...list])}
            onDelete={(ids) =>
              setEmployees(prev => prev.filter(e => !ids.includes(e.id)))
            }
            onUpdate={(updated) =>
              setEmployees(prev =>
                prev.map(e => updated.find(u => u.id === e.id) || e)
              )
            }
          />
        );

      case "attendance":
        return (
          <AttendanceTracker
            employees={(employees || []).filter(e => e?.status === "Active")}
            shifts={shifts || []}
            records={attendanceRecords || []}
            holidays={holidays || []}
            payrollConfig={payrollConfig}
            onUpdate={async (record) => {

              await addData("attendance", record);

              setAttendanceRecords(prev => [...prev, record]);

            }}
            onBulkUpdate={async (records) => {

              for (const r of records) {
                await addData("attendance", r);
              }

              setAttendanceRecords(prev => [...prev, ...records]);

            }}
          />
        );

      case "leaves":
        return (
          <LeaveManagement
            employees={employees}
            leaveRequests={leaveRequests}
            holidays={holidays}
            onAddRequest={(req) => setLeaveRequests(prev => [...prev, req])}
            onUpdateRequest={(req) =>
              setLeaveRequests(prev =>
                prev.map(r => (r.id === req.id ? req : r))
              )
            }
            onUpdateHolidays={setHolidays}
          />
        );

      case "shifts":
        return (
          <ShiftManagement
            shifts={shifts}
            onAdd={(s) => setShifts(prev => [...prev, s])}
            onUpdate={(s) =>
              setShifts(prev => prev.map(sh => (sh.id === s.id ? s : sh)))
            }
            onDelete={(id) =>
              setShifts(prev => prev.filter(s => s.id !== id))
            }
          />
        );

      case "loans":
        return (
          <LoanManagement
            loans={loans}
            employees={employees}
            onAdd={(l) => setLoans(prev => [...prev, l])}
            onUpdate={(l) =>
              setLoans(prev => prev.map(lo => (lo.id === l.id ? l : lo)))
            }
            onDelete={(id) =>
              setLoans(prev => prev.filter(l => l.id !== id))
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

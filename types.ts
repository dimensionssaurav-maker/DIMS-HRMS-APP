export { AttendanceStatus } from './enums';

export { ExpenseCategory } from './enums';

export { LoanType } from './enums';

export { ClaimStatus } from './enums';

export { LeaveType } from './enums';

export { LeaveStatus } from './enums';

export interface DeductionRule {
  id: string;
  department?: string;      // Optional, defaults to 'All Departments'
  thresholdMinutes: number; // Slab FROM: late/early more than this many minutes
  maxMinutes?: number;      // Slab TO: late/early up to this many minutes (undefined = no upper limit)
  deductionAmount: number;  // Deduction in salary-hours
  exemptionsCount?: number; // Times exempted per month before deduction applies
  enabled: boolean;
}

export interface OTRule {
  id: string;
  department: string; // 'All Departments' or specific
  thresholdMinutes: number; // If OT > this
  payoutAmount: number;     // Pay this many hours
  enabled: boolean;
}

export interface PayrollConfig {
  globalOtMultiplier: number;
  designationOverrides: Record<string, number>;
  foodingConfig: {
    enabled: boolean;
    minHours: number;
    amount: number;
    departmentOverrides: Record<string, { minHours: number; amount: number }>;
  };
  attendanceConfig?: {
    lateRules: DeductionRule[];
    earlyExitRules: DeductionRule[];
  };
  otConfig?: {
    enabled: boolean;
    rules: OTRule[];
  };
  recruitmentConfig?: {
    sources: string[];
    serviceChargeRates: number[];
  };
}

export interface Employee {
  id: string;
  name: string;
  designation: string;
  department: string;
  joiningDate: string;
  isOtAllowed: boolean;
  // Status
  status: 'Active' | 'Left' | 'Deleted';
  leavingDate?: string;
  // Salary Config
  salaryType: 'Daily' | 'Monthly';
  dailyWage: number; // Used if type is Daily
  monthlySalary: number; // Used if type is Monthly
  monthlyBase: number; // Calculated base for sorting/display
  // Shift Config
  shiftId?: string;
  // Hiring Config
  source?: string;
  serviceChargeRate?: number;
  // Profile
  avatar?: string;
}

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'HR' | 'Manager' | 'Employee';
  status: 'Active' | 'Inactive';
  lastLogin: string;
  isLocked?: boolean;
  password?: string; // hashed or plain for demo
  employeeId?: string; // linked employee record (for Employee role)
}

export interface Loan {
  id: string;
  employeeId: string;
  amount: number;
  type: LoanType;
  issueDate: string;
  tenureMonths: number;
  description?: string;
}

export interface AttendanceRecord {
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  overtimeHours: number;
  checkIn?: string; // Format "HH:mm"
  checkOut?: string; // Format "HH:mm"
  lateMinutes?: number;
  earlyMinutes?: number;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
  type: 'Full' | 'Short';
  shortDayEndTime?: string; // e.g. "16:00"
}

export interface PayrollCalculation {
  employeeId: string;
  month: string;
  year: number;
  daysPresent: number;
  daysAbsent: number;
  holidays: number;
  totalOvertimeHours: number;
  totalLateMinutes: number;
  grossSalary: number;
  basicSalary: number;
  overtimePay: number;
  foodingAllowance: number;
  expenseReimbursement: number;
  esicEmployeeShare: number;
  esicEmployerShare: number;
  lwfEmployeeShare: number;
  lwfEmployerShare: number;
  serviceCharge: number;
  loanDeduction: number;
  lateDeduction: number;
  earlyDeduction: number;
  lateCount: number;
  earlyCount: number;
  lateHours: number;
  earlyHours: number;
  netPayable: number;
}

export interface Expense {
  id: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  description: string;
  hasReceipt?: boolean;
}

export interface ExpenseClaim {
  id: string;
  employeeId: string;
  title: string;
  description?: string;
  amount: number;
  date: string;
  status: ClaimStatus;
  itemsCount: number;
  location: string;
  branch?: string;
  submittedDate: string;
}

export interface Shift {
  id: string;
  name: string;
  site: string;
  startTime: string; // Format "HH:mm"
  endTime: string;   // Format "HH:mm"
  workingHours: number;
  gracePeriodMinutes: number;
  breakDurationMinutes: number;
  overtimeThresholdHours: number;
  isNightShift: boolean;
  sundaySchedule?: {
    enabled: boolean; // Is Sunday a working day?
    startTime: string;
    endTime: string;
    isFullDayOvertime: boolean; // If true, all work hours count as OT
  };
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  days: number;
  type: LeaveType;
  reason: string;
  status: LeaveStatus;
  appliedOn: string;
}

export interface MonthlyReport {
  month: string;
  year: number;
  totalPayout: number;
  totalEmployees: number;
  avgAttendance: number;
  totalOvertime: number;
  departmentBreakdown?: Record<string, number>;
}

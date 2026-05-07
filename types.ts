export { AttendanceStatus } from './enums';

export { ExpenseCategory } from './enums';

export { LoanType } from './enums';

export { ClaimStatus } from './enums';

export { LeaveType } from './enums';

export { LeaveStatus } from './enums';

export interface DeductionRule {
  id: string;
  department?: string;
  thresholdMinutes: number;
  maxMinutes?: number;
  deductionAmount: number;
  exemptionsCount?: number;
  enabled: boolean;
}

export interface OTRule {
  id: string;
  department: string;
  thresholdMinutes: number;
  payoutAmount: number;
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
  status: 'Active' | 'Left' | 'Deleted';
  leavingDate?: string;
  salaryType: 'Daily' | 'Monthly';
  dailyWage: number;
  monthlySalary: number;
  monthlyBase: number;
  shiftId?: string;
  source?: string;
  serviceChargeRate?: number;
  avatar?: string;
  esicOverride?: boolean;
}

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'HR' | 'Manager' | 'Employee';
  status: 'Active' | 'Inactive';
  lastLogin: string;
  isLocked?: boolean;
  password?: string;
  employeeId?: string;
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
  checkIn?: string;
  checkOut?: string;
  lateMinutes?: number;
  earlyMinutes?: number;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
  type: 'Full' | 'Short';
  shortDayEndTime?: string;
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


// ─── OT Slab Types (tiered time-based OT) ────────────────────────────────────────────
export interface OTSlab {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  multiplier: number;
  crossesMidnight: boolean;
  enabled: boolean;
}

export interface OTSlabResult {
  slabName: string;
  minutes: number;
  hours: number;
  multiplier: number;
  amount: number;
}

export interface Shift {
  id: string;
  name: string;
  site: string;
  startTime: string;
  endTime: string;
  workingHours: number;
  gracePeriodMinutes: number;
  breakDurationMinutes: number;
  overtimeThresholdHours: number;
  isNightShift: boolean;
  otSlabs?: OTSlab[];
  sundaySchedule?: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    isFullDayOvertime: boolean;
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

export interface ContractorPayment {
  id: string;
  month: string;
  year: number;
  contractorName: string;
  department: string;
  source: string;
  grossAmount: number;
  deduction: number;
  amount: number;
  serviceChargeRate: number;
  serviceCharge: number;
  netPayable: number;
  pdfUrl?: string;
  pdfName?: string;
  createdAt: string;
}

export interface ContractorAdvance {
  id: string;
  contractorName: string;   // matched by name to ContractorPayment
  amount: number;           // original advance issued
  pendingAmount: number;    // remaining to recover
  issuedDate: string;       // "YYYY-MM-DD"
  description?: string;
  status: 'Pending' | 'Partial' | 'Recovered';
  createdAt: string;
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

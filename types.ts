
export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  HOLIDAY = 'HOLIDAY',
  LEAVE = 'LEAVE'
}

export enum ExpenseCategory {
  SALARIES = 'Salaries',
  TRAVEL = 'Travel',
  OFFICE_SUPPLIES = 'Office Supplies',
  UTILITIES = 'Utilities',
  MARKETING = 'Marketing',
  RENT = 'Rent',
  SITE_SERVICES = 'Site Services',
  MISC = 'Miscellaneous'
}

export enum LoanType {
  ADVANCE = 'Advance',
  LOAN = 'Loan'
}

export enum ClaimStatus {
  APPROVED = 'Approved',
  PENDING = 'Under Review',
  DRAFT = 'Draft',
  REJECTED = 'Rejected',
  REIMBURSED = 'Reimbursed'
}

export enum LeaveType {
  SICK = 'Sick Leave',
  CASUAL = 'Casual Leave',
  EARNED = 'Earned Leave',
  UNPAID = 'Loss of Pay'
}

export enum LeaveStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  REJECTED = 'Rejected'
}

export interface DeductionRule {
  id: string;
  department?: string; // Optional for backward compatibility, defaults to 'All Departments'
  thresholdMinutes: number;
  deductionAmount: number; // In hours
  exemptionsCount?: number; // Number of times exempted per month
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
  role: 'Admin' | 'HR' | 'Manager';
  status: 'Active' | 'Inactive';
  lastLogin: string;
  isLocked?: boolean;
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
  earlyDeduction: number; // New Field
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

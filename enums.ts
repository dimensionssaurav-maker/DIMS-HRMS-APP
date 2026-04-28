// Separate file for runtime constants (previously enums)
// Keeping these separate from types.ts prevents Vite TDZ (Temporal Dead Zone) issues

export const AttendanceStatus = {
  PRESENT: 'PRESENT',
  ABSENT:  'ABSENT',
  HOLIDAY: 'HOLIDAY',
  LEAVE:   'LEAVE',
} as const;
export type AttendanceStatus = typeof AttendanceStatus[keyof typeof AttendanceStatus];

export const ClaimStatus = {
  APPROVED:   'Approved',
  PENDING:    'Under Review',
  DRAFT:      'Draft',
  REJECTED:   'Rejected',
  REIMBURSED: 'Reimbursed',
} as const;
export type ClaimStatus = typeof ClaimStatus[keyof typeof ClaimStatus];

export const LeaveStatus = {
  PENDING:  'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
} as const;
export type LeaveStatus = typeof LeaveStatus[keyof typeof LeaveStatus];

export const LeaveType = {
  SICK:    'Sick Leave',
  CASUAL:  'Casual Leave',
  EARNED:  'Earned Leave',
  UNPAID:  'Loss of Pay',
} as const;
export type LeaveType = typeof LeaveType[keyof typeof LeaveType];

export const LoanType = {
  ADVANCE: 'Advance',
  LOAN:    'Loan',
} as const;
export type LoanType = typeof LoanType[keyof typeof LoanType];

export const ExpenseCategory = {
  SALARIES:       'Salaries',
  TRAVEL:         'Travel',
  OFFICE_SUPPLIES:'Office Supplies',
  UTILITIES:      'Utilities',
  MARKETING:      'Marketing',
  RENT:           'Rent',
  SITE_SERVICES:  'Site Services',
  MISC:           'Miscellaneous',
} as const;
export type ExpenseCategory = typeof ExpenseCategory[keyof typeof ExpenseCategory];

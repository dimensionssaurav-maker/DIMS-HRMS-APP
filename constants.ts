
export const ESIC_EMPLOYEE_RATE = 0.0075; // 0.75%
export const ESIC_EMPLOYER_RATE = 0.0325; // 3.25%

// LWF Rules: 0.2% of Gross, Max 34. Employer pays double.
export const LWF_EMPLOYEE_RATE = 0.002; // 0.2%
export const LWF_EMPLOYEE_CAP = 34;

export const SERVICE_CHARGE_RATE = 0.10;   // 10% example
export const OT_HOURLY_RATE_MULTIPLIER = 1.5;

// Empty initial arrays for clean state
export const INITIAL_EMPLOYEES = [];

export const INITIAL_CLAIMS: any[] = [];

export const INITIAL_LEAVES: any[] = [];

export const INITIAL_LOANS: any[] = [];

// General Shift Updated: 09:00 - 17:30, Lunch 13:00-13:30.
// OT Starts after shift end (8.5 hours span).
export const INITIAL_SHIFTS: any[] = [
  {
    id: 's1',
    name: 'General Shift',
    site: 'Main Office',
    startTime: '09:00',
    endTime: '17:30',
    workingHours: 8, // 8.5 span - 0.5 break
    gracePeriodMinutes: 15,
    breakDurationMinutes: 30,
    overtimeThresholdHours: 8.5, // OT triggers after 17:30 (8.5h from 9:00)
    isNightShift: false,
    sundaySchedule: {
      enabled: false,
      startTime: '09:00',
      endTime: '16:00',
      isFullDayOvertime: true
    }
  }
];

export const INITIAL_DEPARTMENTS = ['All Departments', 'Operations', 'Admin', 'HR', 'IT', 'Sales', 'Finance', 'Quality'];

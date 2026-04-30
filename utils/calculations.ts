import {
  ESIC_EMPLOYEE_RATE,
  ESIC_EMPLOYER_RATE,
  LWF_EMPLOYEE_RATE,
  LWF_EMPLOYEE_CAP,
  SERVICE_CHARGE_RATE
} from '../constants';
import type { Shift } from '../types';

// ── OT recalculation from punch times (mirrors AttendanceTracker logic) ──
function recalcOTFromPunch(record: any, employee: any, shifts: Shift[]): number {
  // Trust stored OT if explicitly saved as > 0
  if ((record.overtimeHours ?? 0) > 0) return record.overtimeHours;
  if (!employee.isOtAllowed) return 0;

  const checkIn  = record.checkIn  || record.punchIn  || '';
  const checkOut = record.checkOut || record.punchOut || '';
  if (!checkIn || !checkOut) return 0;

  const shift = shifts.find((s: Shift) => s.id === employee.shiftId);
  if (!shift) return 0;

  const toM = (t: string): number => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const dateObj = new Date(record.date);
  const isSunday = dateObj.getDay() === 0;

  if (isSunday && shift.sundaySchedule?.enabled) {
    const sd = shift.sundaySchedule;
    let sunStart = toM(sd.startTime);
    let sunEnd   = toM(sd.endTime);
    let ciMins   = toM(checkIn);
    let coMins   = toM(checkOut);
    if (sunEnd < sunStart) sunEnd += 1440;
    if (coMins < ciMins)   coMins += 1440;
    const workedHours = (coMins - ciMins) / 60;

    if (sd.isFullDayOvertime) {
      // Sunday full-day OT: worked ≥ 7h → pay 8h (or actual if > 8)
      if (workedHours >= 7) return Math.max(8, workedHours);
      return workedHours;
    }
    // Sunday with partial OT: OT = time after Sunday shift end
    let cOut = coMins;
    if (cOut < sunEnd - 600) cOut += 1440;
    const otM = cOut - sunEnd;
    return otM > 0 ? otM / 60 : 0;
  }

  // Standard shift: OT = time after shift end
  const shiftEndMins = toM(shift.endTime);
  let cOut = toM(checkOut);
  if (cOut < shiftEndMins - 600) cOut += 1440;
  const otMinutes = cOut - shiftEndMins;
  return otMinutes > 0 ? otMinutes / 60 : 0;
}

// ── Status normalizer helpers (module-level to avoid TDZ in minified build) ──
function isPresentStatus(s: string): boolean {
  const v = String(s || '').toUpperCase();
  return v === 'PRESENT' || v === 'P' || v.startsWith('P/');
}
function isAbsentStatus(s: string): boolean {
  const v = String(s || '').toUpperCase();
  return v === 'ABSENT' || v === 'A';
}
function isHolidayStatus(s: string): boolean {
  const v = String(s || '').toUpperCase();
  return v === 'HOLIDAY' || v === 'H' || v === 'WO';
}
// RULE: Days Paid = PRESENT + (HALFDAY / 2) + HOLIDAY
// Half-day statuses: HD, HALFDAY, HALF, P/H, H/P
function isHalfDayStatus(s: string): boolean {
  const v = String(s || '').toUpperCase();
  return v === 'HD' || v === 'HALFDAY' || v === 'HALF' || v === 'P/H' || v === 'H/P';
}

export function calculateMonthlyPayroll(
  employee: Employee,
  attendance: AttendanceRecord[],
  loans: Loan[],
  claims: ExpenseClaim[],
  holidays: Holiday[],
  month: string,
  year: number,
  config: PayrollConfig,
  shifts: Shift[] = []
): PayrollCalculation {
  const empCode = (employee as any).employeeCode || employee.id;
  const empAttendance = attendance
    .filter(a =>
      a.employeeId === employee.id ||
      a.employeeId === empCode ||
      (a as any).empCode === empCode ||
      (a as any).empCode === (employee as any).employeeCode
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Joining date MUST be declared before any filter that uses joinDay (prevents Vite TDZ bug)
  const joiningDate = employee.joiningDate ? new Date(employee.joiningDate) : null;
  const joinDay = joiningDate
    ? new Date(joiningDate.getFullYear(), joiningDate.getMonth(), joiningDate.getDate())
    : null;

  // Filter out any records before joining date
  const validAttendance = empAttendance.filter(a => {
    if (!joinDay) return true;
    const aDate = new Date(a.date);
    return aDate >= joinDay;
  });

  const monthIndex = new Date(`${month} 1, 2000`).getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  // ── READ DAYS PAID DIRECTLY FROM ATTENDANCE — same source as attendance page ──
  // Build full-month day list (identical to AttendanceTracker monthDays)
  const allMonthDays: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    allMonthDays.push(`${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }

  // Track manual HOLIDAY records to avoid double-counting auto-holidays
  const manualHolidayDates = new Set(
    allMonthDays.filter(date => empAttendance.some(r => r.date === date && isHolidayStatus(r.status)))
  );

  // Count exactly as AttendanceTracker.getEmpMonthlySummary does
  let daysPresent = 0;
  let halfDays = 0;
  let daysAbsent = 0;
  let totalPaidHolidays = 0;

  allMonthDays.forEach(date => {
    const r = empAttendance.find(a => a.date === date);
    const dateObj = new Date(date);
    const isSun = dateObj.getDay() === 0;
    const hol = holidays.find(h => h.date === date && h.type === 'Full');
    const isBeforeJoining = joinDay ? dateObj < joinDay : false;
    if (isBeforeJoining) return;

    if (r) {
      if (isHalfDayStatus(r.status)) halfDays++;
      else if (isPresentStatus(r.status)) daysPresent++;
      else if (isAbsentStatus(r.status)) daysAbsent++;
      else if (isHolidayStatus(r.status)) totalPaidHolidays++;
    } else {
      const coveredByGlobalHoliday = hol && !manualHolidayDates.has(date);
      const isSundayOff = isSun && !hol;
      if (coveredByGlobalHoliday || isSundayOff) totalPaidHolidays++;
    }
  });

  // OT: recalculate from punch times if stored value is 0, then floor to whole hours
  const totalOvertimeHours = empAttendance.reduce((acc, curr) => {
    const raw = recalcOTFromPunch(curr, employee, shifts);
    return acc + Math.floor(raw); // floor: 3.52→3, 0.82→0
  }, 0);
  const totalLateMinutes = empAttendance.reduce((acc, curr) => acc + (Number(curr.lateMinutes) || 0), 0);

  const monthlySal = Number(employee.monthlySalary || (employee as any).salary || 0) || 0;
  const dailyWage  = Number(employee.dailyWage || 0) || 0;

  let dailyRate = 0;
  if (employee.salaryType === 'Daily') {
    dailyRate = dailyWage;
  } else if (monthlySal > 0) {
    dailyRate = monthlySal / daysInMonth;
  } else if (dailyWage > 0) {
    dailyRate = dailyWage;
  }

  const hourlyRate = dailyRate / 8;
  // RULE: Days Paid = PRESENT + (HALFDAY / 2) + HOLIDAY
  const totalDaysPaid = daysPresent + (halfDays / 2) + totalPaidHolidays;
  const basicSalary = totalDaysPaid * dailyRate;

  let overtimePay = 0;
  let foodingAllowance = 0;

  if (employee.isOtAllowed) {
    // Guard multiplier against undefined/NaN → default to 1 (1× pay)
    const rawMultiplier = config.designationOverrides?.[employee.designation] ?? config.globalOtMultiplier;
    const multiplier = (rawMultiplier != null && !isNaN(Number(rawMultiplier))) ? Number(rawMultiplier) : 1;
    let effectiveTotalPayableOT = 0;

    empAttendance.forEach(record => {
      // Recalculate OT from punch times; floor to whole hours
      const rawOT = recalcOTFromPunch(record, employee, shifts);
      const flooredOT = Math.floor(rawOT); // 3.52→3, 0.82→0
      if (flooredOT <= 0) return;          // skip if < 1 whole OT hour

      let dailyPayableHours = flooredOT;

      // Apply global OT rules (threshold → payout remapping)
      if (config.otConfig?.enabled && config.otConfig.rules && config.otConfig.rules.length > 0) {
        const otMinutes = flooredOT * 60;
        const applicableRules = config.otConfig.rules.filter((r: any) =>
          r.enabled && (r.department === 'All Departments' || r.department === employee.department)
        );
        const sortedRules = applicableRules.sort((a: any, b: any) => b.thresholdMinutes - a.thresholdMinutes);
        const matchedRule = sortedRules.find((r: any) => otMinutes >= r.thresholdMinutes);
        if (matchedRule) dailyPayableHours = matchedRule.payoutAmount;
      }

      effectiveTotalPayableOT += dailyPayableHours;

      // Fooding: NOT on Sundays, only on working days with enough OT hours
      const isSunday = new Date(record.date).getDay() === 0;
      if (!isSunday && config.foodingConfig && config.foodingConfig.enabled) {
        const deptRule = config.foodingConfig.departmentOverrides?.[employee.department];
        const effectiveMinHours = deptRule ? deptRule.minHours : config.foodingConfig.minHours;
        const effectiveAmount   = deptRule ? deptRule.amount   : config.foodingConfig.amount;
        if (flooredOT >= effectiveMinHours) foodingAllowance += effectiveAmount;
      }
    });

    overtimePay = effectiveTotalPayableOT * (isNaN(hourlyRate) ? 0 : hourlyRate) * multiplier;
  }

  let totalLateHours  = 0;
  let totalEarlyHours = 0;
  let lateCount  = 0;   // instances that actually triggered a deduction (after exemptions)
  let earlyCount = 0;   // instances that actually triggered a deduction (after exemptions)
  const hourlyRateForDeduction = hourlyRate;
  const lateRuleUsage:  Record<string, number> = {};
  const earlyRuleUsage: Record<string, number> = {};

  const findApplicableRule = (minutes: number, rules?: DeductionRule[]) => {
    if (!rules || minutes <= 0) return null;
    const applicableRules = rules.filter(r =>
      r.enabled && (r.department === 'All Departments' || !r.department || r.department === employee.department)
    );
    if (applicableRules.length === 0) return null;
    // Prefer department-specific rules over 'All Departments'
    const sortedRules = applicableRules.sort((a, b) => {
      const aS = a.department && a.department !== 'All Departments';
      const bS = b.department && b.department !== 'All Departments';
      if (aS && !bS) return -1;
      if (!aS && bS) return 1;
      return a.thresholdMinutes - b.thresholdMinutes; // ascending: match lowest slab first
    });
    // Slab match: minutes > thresholdMinutes AND (no maxMinutes OR minutes <= maxMinutes)
    return sortedRules.find(r =>
      minutes > r.thresholdMinutes &&
      (r.maxMinutes === undefined || r.maxMinutes === null || minutes <= r.maxMinutes)
    );
  };

  empAttendance.forEach(record => {
    if (record.lateMinutes && record.lateMinutes > 0) {
      if (config.attendanceConfig?.lateRules) {
        const rule = findApplicableRule(record.lateMinutes, config.attendanceConfig.lateRules);
        if (rule) {
          lateRuleUsage[rule.id] = (lateRuleUsage[rule.id] || 0) + 1;
          if (lateRuleUsage[rule.id] > (rule.exemptionsCount || 0)) { totalLateHours += rule.deductionAmount; lateCount++; }
        }
      } else {
        totalLateHours += (record.lateMinutes / 60); lateCount++;
      }
    }

    if (record.earlyMinutes && record.earlyMinutes > 0) {
      const holiday = holidays.find(h => h.date === record.date && h.type === 'Short');
      let effectiveEarlyMinutes = record.earlyMinutes;
      if (holiday && holiday.shortDayEndTime && record.checkOut) {
        const [hH, hM] = holiday.shortDayEndTime.split(':').map(Number);
        const [cH, cM] = record.checkOut.split(':').map(Number);
        if ((cH * 60 + cM) >= (hH * 60 + hM)) effectiveEarlyMinutes = 0;
      }
      if (effectiveEarlyMinutes > 0 && config.attendanceConfig?.earlyExitRules) {
        const rule = findApplicableRule(effectiveEarlyMinutes, config.attendanceConfig.earlyExitRules);
        if (rule) {
          earlyRuleUsage[rule.id] = (earlyRuleUsage[rule.id] || 0) + 1;
          if (earlyRuleUsage[rule.id] > (rule.exemptionsCount || 0)) { totalEarlyHours += rule.deductionAmount; earlyCount++; }
        }
      }
    }
  });

  const lateDeduction  = Math.round(totalLateHours  * hourlyRateForDeduction * 100) / 100;
  const earlyDeduction = Math.round(totalEarlyHours * hourlyRateForDeduction * 100) / 100;

  overtimePay       = Math.round(overtimePay       * 100) / 100;
  foodingAllowance  = Math.round(foodingAllowance  * 100) / 100;
  const roundedBasicSalary = Math.round(basicSalary * 100) / 100;
  const grossSalary = roundedBasicSalary + overtimePay + foodingAllowance;

  let expenseReimbursement = 0;
  if (claims) {
    expenseReimbursement = claims
      .filter(c => {
        const cDate = new Date(c.date);
        return c.employeeId === employee.id &&
               c.status === 'Approved' &&
               cDate.t
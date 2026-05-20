import {
  ESIC_EMPLOYEE_RATE,
  ESIC_EMPLOYER_RATE,
  LWF_EMPLOYEE_RATE,
  LWF_EMPLOYEE_CAP,
  SERVICE_CHARGE_RATE
} from '../constants';
import type { Shift } from '../types';

// ── OT recalculation from punch times (mirrors AttendanceTracker logic) ──
// ALWAYS prefers punch time recalculation. Stored overtimeHours may be from old
// threshold-based biometric sync and cannot be trusted when punch times are available.
function recalcOTFromPunch(record: any, employee: any, shifts: Shift[]): number {
  if (!employee.isOtAllowed) return 0;

  const checkIn  = record.checkIn  || record.punchIn  || '';
  const checkOut = record.checkOut || record.punchOut || '';

  // No punch times -> fall back to stored value (manual entry)
  if (!checkIn || !checkOut) return (record.overtimeHours ?? 0);

  const shift = shifts.find((s: Shift) => s.id === employee.shiftId);
  if (!shift) return (record.overtimeHours ?? 0);

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

    // Sunday full-day OT: mirrors OvertimeModule (no isFullDayOvertime gate)
    if (workedHours >= 6.5) return Math.max(8, workedHours);
    return workedHours;
  }

  // Standard shift: OT = time after shift end
  const shiftEndMins = toM(shift.endTime);
  let cOut = toM(checkOut);
  if (cOut < shiftEndMins - 600) cOut += 1440;
  const otMinutes = cOut - shiftEndMins;
  return otMinutes > 0 ? otMinutes / 60 : 0;
}

// -- Status normalizer helpers (module-level to avoid TDZ in minified build) --
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

  // -- READ DAYS PAID DIRECTLY FROM ATTENDANCE -- same source as attendance page --
  // Build full-month day list (identical to AttendanceTracker monthDays)
  const allMonthDays: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    allMonthDays.push(`${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }

  // ── Only look at records that fall inside the selected month ─────────────
  // empAttendance contains ALL months; using it unfiltered caused OT/fooding
  // from previous months to bleed into the current month's payroll.
  const monthDaySet = new Set(allMonthDays);
  const monthAttendance = empAttendance.filter(r => monthDaySet.has(r.date));

  // Track manual HOLIDAY records to avoid double-counting auto-holidays
  const manualHolidayDates = new Set(
    allMonthDays.filter(date => monthAttendance.some(r => r.date === date && isHolidayStatus(r.status)))
  );

  // Count exactly as AttendanceTracker.getEmpMonthlySummary does
  let daysPresent = 0;
  let halfDays = 0;
  let daysAbsent = 0;
  let totalPaidHolidays = 0;

  allMonthDays.forEach(date => {
    const r = monthAttendance.find(a => a.date === date);
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
      if (isSun && !hol) {
        // Sunday week-off rule: paid only if employee was present ≥ 3 days (Mon–Sat) that week
        const sunDate = new Date(date);
        let weekPresent = 0;
        for (let back = 1; back <= 6; back++) {
          const wd = new Date(sunDate);
          wd.setDate(sunDate.getDate() - back);
          const wdStr = wd.toISOString().slice(0, 10);
          const wr = empAttendance.find(a => a.date === wdStr);
          if (wr && (isPresentStatus(wr.status) || isHalfDayStatus(wr.status))) weekPresent++;
        }
        if (weekPresent >= 3) totalPaidHolidays++;
        // else: unpaid Sunday — absent from enough days this week
      } else if (coveredByGlobalHoliday) {
        totalPaidHolidays++;
      }
    }
  });

  // OT: recalculate from punch times if stored value is 0, then floor to nearest 0.5h
  // Use monthAttendance (not empAttendance) so only this month's records count.
  const totalOvertimeHours = monthAttendance.reduce((acc, curr) => {
    const raw = recalcOTFromPunch(curr, employee, shifts);
    return acc + Math.floor(raw * 2) / 2; // floor to 0.5h: 3.52->3.5, 6.12->6.0
  }, 0);
  const totalLateMinutes = monthAttendance.reduce((acc, curr) => acc + (Number(curr.lateMinutes) || 0), 0);

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
  let travelAllowance = 0;
  let payableOT = totalOvertimeHours;

  if (employee.isOtAllowed) {
    // Multiplier fixed at 1 — OT paid at straight hourly rate (no premium)
    const multiplier = 1;
    let effectiveTotalPayableOT = 0;

    monthAttendance.forEach(record => {
      // Recalculate OT from punch times; floor to nearest 0.5h
      const rawOT = recalcOTFromPunch(record, employee, shifts);
      const flooredOT = Math.floor(rawOT * 2) / 2; // 3.52->3.5, 6.12->6.0
      if (flooredOT <= 0) return;                   // skip if no OT
      const isSunRec = new Date(record.date).getDay() === 0;
      const recShift = shifts?.find((s: Shift) => s.id === employee.shiftId);
      const isFullDaySun = isSunRec && recShift?.sundaySchedule?.enabled && recShift?.sundaySchedule?.isFullDayOvertime;

      let dailyPayableHours = flooredOT;

      // Apply Factory OT Slab Rules (priority)
      if (!isFullDaySun && config.factoryOTConfig?.enabled) {
        const deptConfigs = config.factoryOTConfig.deptConfigs ?? [];
        const deptCfg = deptConfigs.find((d: any) => d.enabled && d.department === employee.department)
                     ?? deptConfigs.find((d: any) => d.enabled && d.department === 'All Departments');
        if (deptCfg) {
          const slabs: any[] = deptCfg.slabs ?? [];
          const slab1 = slabs[0]; // Slab 1 = minimum gate
          if (!slab1 || flooredOT < slab1.requiredHours) {
            dailyPayableHours = 0; // below minimum → no OT
          } else {
            const sorted = [...slabs].sort((a: any, b: any) => b.requiredHours - a.requiredHours);
            const matched = sorted.find((s: any) => flooredOT >= s.requiredHours);
            if (matched) dailyPayableHours = Math.floor((matched.requiredHours + matched.bonusHours) * 2) / 2;
          }
        }
      // Classic threshold → payout rules
      } else if (!isFullDaySun && config.otConfig?.enabled && config.otConfig.rules && config.otConfig.rules.length > 0) {
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

      // Travel allowance: paid in cash on days employee is present (or OT days)
      if (!isSunday && (config as any).travelConfig?.enabled) {
        const tc = (config as any).travelConfig;
        const deptT = tc.departmentOverrides?.[employee.department];
        const tMinHours = deptT ? deptT.minHours : (tc.minHours ?? 0);
        const tAmount   = deptT ? deptT.amount   : (tc.amount ?? 0);
        if (flooredOT >= tMinHours) travelAllowance += tAmount;
      }
    });

    overtimePay = effectiveTotalPayableOT * (isNaN(hourlyRate) ? 0 : hourlyRate) * multiplier;
    payableOT = effectiveTotalPayableOT;
  }

  let totalLateHours  = 0;
  let totalEarlyHours = 0;
  let lateCount  = 0;
  let earlyCount = 0;
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
      return a.thresholdMinutes - b.thresholdMinutes;
    });
    return sortedRules.find(r =>
      minutes > r.thresholdMinutes &&
      (r.maxMinutes === undefined || r.maxMinutes === null || minutes <= r.maxMinutes)
    );
  };

  monthAttendance.forEach(record => {
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
  travelAllowance   = Math.round(travelAllowance   * 100) / 100;
  const roundedBasicSalary = Math.round(basicSalary * 100) / 100;
  const cashDisbursement = Math.round((foodingAllowance + travelAllowance) * 100) / 100;
  const grossSalary = roundedBasicSalary + overtimePay + foodingAllowance + travelAllowance;

  let expenseReimbursement = 0;
  if (claims) {
    expenseReimbursement = claims
      .filter(c => {
        const cDate = new Date(c.date);
        return c.employeeId === employee.id &&
               c.status === 'Approved' &&
               cDate.toLocaleString('default', { month: 'long' }) === month &&
               cDate.getFullYear() === year;
      })
      .reduce((sum, c) => sum + c.amount, 0);
  }

  // ESIC only applies to employees with monthly salary <= 21,000 (statutory ceiling)
  const ESIC_SALARY_CEILING = 21000;
  const isEsicApplicable = monthlySal > 0 && (monthlySal <= ESIC_SALARY_CEILING || employee.esicOverride === true);
  const esicBase = (isEsicApplicable && (employee as any).esicOverride && monthlySal > ESIC_SALARY_CEILING)
    ? Math.min(grossSalary, ESIC_SALARY_CEILING)
    : grossSalary;
  const esicEmployeeShare = isEsicApplicable ? Math.round(esicBase * ESIC_EMPLOYEE_RATE * 100) / 100 : 0;
  const esicEmployerShare = isEsicApplicable ? Math.round(esicBase * ESIC_EMPLOYER_RATE * 100) / 100 : 0;

  let lwfEmployeeShare = 0;
  let lwfEmployerShare = 0;
  if (grossSalary > 0) {
    lwfEmployeeShare = Math.round(Math.min(grossSalary * LWF_EMPLOYEE_RATE, LWF_EMPLOYEE_CAP) * 100) / 100;
    lwfEmployerShare = Math.round(lwfEmployeeShare * 2 * 100) / 100;
  }

  const payrollDate = new Date(year, monthIndex, 1);
  let totalLoanDeduction = 0;
  loans.filter(l => l.employeeId === employee.id).forEach(loan => {
    const loanDate        = new Date(loan.issueDate);
    const loanStartPeriod = new Date(loanDate.getFullYear(), loanDate.getMonth(), 1);
    const loanEndPeriod   = new Date(loanStartPeriod);
    loanEndPeriod.setMonth(loanEndPeriod.getMonth() + loan.tenureMonths);
    if (payrollDate >= loanStartPeriod && payrollDate < loanEndPeriod)
      totalLoanDeduction += loan.amount / loan.tenureMonths;
  });
  totalLoanDeduction = Math.round(totalLoanDeduction * 100) / 100;

  const netPayable        = grossSalary + expenseReimbursement - lateDeduction - earlyDeduction - esicEmployeeShare - lwfEmployeeShare - totalLoanDeduction;
  const roundedNetPayable = Math.round(netPayable * 100) / 100;

  const effectiveServiceRate = employee.serviceChargeRate !== undefined ? employee.serviceChargeRate : SERVICE_CHARGE_RATE;
  const serviceCharge = Math.round(grossSalary * effectiveServiceRate * 100) / 100;

  return {
    employeeId: employee.id,
    month,
    year,
    daysPresent,
    daysAbsent,
    holidays: totalPaidHolidays,
    totalOvertimeHours: payableOT,
    totalLateMinutes,
    basicSalary: roundedBasicSalary,
    grossSalary,
    overtimePay,
    foodingAllowance,
    travelAllowance,
    cashDisbursement,
    expenseReimbursement,
    esicEmployeeShare,
    esicEmployerShare,
    lwfEmployeeShare,
    lwfEmployerShare,
    serviceCharge,
    loanDeduction: totalLoanDeduction,
    lateDeduction,
    earlyDeduction,
    lateCount,
    earlyCount,
    lateHours: Math.round(totalLateHours * 100) / 100,
    earlyHours: Math.round(totalEarlyHours * 100) / 100,
    netPayable: roundedNetPayable
  };
}

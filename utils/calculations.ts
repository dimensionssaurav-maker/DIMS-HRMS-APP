
import { 
  ESIC_EMPLOYEE_RATE, 
  ESIC_EMPLOYER_RATE, 
  LWF_EMPLOYEE_RATE,
  LWF_EMPLOYEE_CAP,
  SERVICE_CHARGE_RATE 
} from '../constants';
import { Employee, AttendanceRecord, AttendanceStatus, PayrollCalculation, Loan, PayrollConfig, DeductionRule, ExpenseClaim, ClaimStatus, Holiday } from '../types';

export function calculateMonthlyPayroll(
  employee: Employee, 
  attendance: AttendanceRecord[], 
  loans: Loan[],
  claims: ExpenseClaim[],
  holidays: Holiday[],
  month: string, 
  year: number,
  config: PayrollConfig
): PayrollCalculation {
  // Sort attendance records by date to ensure exemptions apply chronologically
  const empAttendance = attendance
    .filter(a => a.employeeId === employee.id)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const daysPresent = empAttendance.filter(a => a.status === AttendanceStatus.PRESENT).length;
  const daysAbsent = empAttendance.filter(a => a.status === AttendanceStatus.ABSENT).length;
  // Manual holidays marked in attendance tracker
  const manualHolidays = empAttendance.filter(a => a.status === AttendanceStatus.HOLIDAY).length;

  // Calculate Auto Holidays from the Global Holiday List
  // Logic: If a date is in the holiday list, AND there is no conflicting attendance record for this employee, count it.
  const monthIndex = new Date(`${month} 1, 2000`).getMonth();
  
  let autoHolidays = 0;
  holidays.forEach(h => {
      // Only treat 'Full' holidays as automatic paid holidays if absent.
      // 'Short' holidays are working days, so if no record, it's just absent.
      if (h.type !== 'Full') return;

      const hDate = new Date(h.date);
      if (hDate.getMonth() === monthIndex && hDate.getFullYear() === year) {
          // Check if there is an explicit record for this day (e.g. they worked, or were marked absent)
          const hasRecord = empAttendance.some(r => r.date === h.date);
          if (!hasRecord) {
              autoHolidays++;
          }
      }
  });

  const totalPaidHolidays = manualHolidays + autoHolidays;

  const totalOvertimeHours = empAttendance.reduce((acc, curr) => acc + curr.overtimeHours, 0);
  const totalLateMinutes = empAttendance.reduce((acc, curr) => acc + (curr.lateMinutes || 0), 0);

  // 1. Determine Effective Daily Rate
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  
  let dailyRate = 0;
  if (employee.salaryType === 'Monthly' && employee.monthlySalary > 0) {
      dailyRate = employee.monthlySalary / daysInMonth;
  } else {
      dailyRate = employee.dailyWage;
  }

  // 2. Basic Salary Calculation (Days Worked + Holidays)
  const basicSalary = (daysPresent + totalPaidHolidays) * dailyRate;
  
  // 3. Overtime & Fooding Calculation
  let overtimePay = 0;
  let foodingAllowance = 0;

  if (employee.isOtAllowed) {
    const hourlyRate = (dailyRate / 8); // Assuming 8 hour shift base for rate calculation
    // Determine multiplier: Check designation override, fallback to global
    const multiplier = config.designationOverrides[employee.designation] ?? config.globalOtMultiplier;

    // Calculate Payable OT based on Daily Rules
    let effectiveTotalPayableOT = 0;

    empAttendance.forEach(record => {
        if (!record.overtimeHours) return;

        let dailyPayableHours = record.overtimeHours;

        // Apply Tiered Rules if Enabled
        if (config.otConfig?.enabled && config.otConfig.rules && config.otConfig.rules.length > 0) {
            const otMinutes = record.overtimeHours * 60;
            
            // Filter applicable rules
            const applicableRules = config.otConfig.rules.filter(r => 
                r.enabled && (r.department === 'All Departments' || r.department === employee.department)
            );

            // Sort by Threshold DESC to find highest match first
            // Prioritize specific department rules over generic if thresholds are same? 
            // Usually strict threshold priority is safer: Higher threshold = Higher payout likely.
            const sortedRules = applicableRules.sort((a, b) => b.thresholdMinutes - a.thresholdMinutes);

            const matchedRule = sortedRules.find(r => otMinutes >= r.thresholdMinutes);
            if (matchedRule) {
                dailyPayableHours = matchedRule.payoutAmount;
            }
        }

        effectiveTotalPayableOT += dailyPayableHours;

        // Calculate Fooding (Logic remains based on actual hours usually, but could be debated. Sticking to actuals for fooding qualification)
        if (config.foodingConfig && config.foodingConfig.enabled) {
            const deptRule = config.foodingConfig.departmentOverrides?.[employee.department];
            const effectiveMinHours = deptRule ? deptRule.minHours : config.foodingConfig.minHours;
            const effectiveAmount = deptRule ? deptRule.amount : config.foodingConfig.amount;

            if (record.overtimeHours >= effectiveMinHours) {
                foodingAllowance += effectiveAmount;
            }
        }
    });
    
    overtimePay = effectiveTotalPayableOT * hourlyRate * multiplier;
  }

  // 4. Attendance Rule Deductions (Late Arrival & Early Exit) with Exemptions
  // Logic: Count occurrences of specific rule violations and waive deduction if within exemption limit.
  
  let totalLateHours = 0;
  let totalEarlyHours = 0;
  
  const hourlyRateForDeduction = dailyRate / 8; // Standard 8hr day divisor

  // Tracking rule usage counts: ruleId -> count
  const lateRuleUsage: Record<string, number> = {};
  const earlyRuleUsage: Record<string, number> = {};

  // Helper to find applicable rule
  const findApplicableRule = (minutes: number, rules?: DeductionRule[]) => {
      if (!rules || minutes <= 0) return null;
      
      const applicableRules = rules.filter(r => 
          r.enabled && (r.department === 'All Departments' || !r.department || r.department === employee.department)
      );

      if (applicableRules.length === 0) return null;

      // Sort: Specific Dept > Generic, then Higher Threshold > Lower
      const sortedRules = applicableRules.sort((a, b) => {
          const aIsSpecific = a.department && a.department !== 'All Departments';
          const bIsSpecific = b.department && b.department !== 'All Departments';
          
          if (aIsSpecific && !bIsSpecific) return -1; 
          if (!aIsSpecific && bIsSpecific) return 1;  
          
          return b.thresholdMinutes - a.thresholdMinutes;
      });
      
      return sortedRules.find(r => minutes > r.thresholdMinutes);
  };

  empAttendance.forEach(record => {
      // Late Deduction
      if (record.lateMinutes && record.lateMinutes > 0) {
          if (config.attendanceConfig?.lateRules) {
              const rule = findApplicableRule(record.lateMinutes, config.attendanceConfig.lateRules);
              if (rule) {
                  // Increment usage for this rule
                  lateRuleUsage[rule.id] = (lateRuleUsage[rule.id] || 0) + 1;
                  
                  // Check exemption
                  const exemptionLimit = rule.exemptionsCount || 0;
                  if (lateRuleUsage[rule.id] > exemptionLimit) {
                      totalLateHours += rule.deductionAmount;
                  }
              }
          } else {
              // Fallback to legacy proportional calculation if no rules configured
              totalLateHours += (record.lateMinutes / 60);
          }
      }

      // Early Exit Deduction
      if (record.earlyMinutes && record.earlyMinutes > 0) {
          // Special Check: Was this a Short Holiday?
          const holiday = holidays.find(h => h.date === record.date && h.type === 'Short');
          let effectiveEarlyMinutes = record.earlyMinutes;

          if (holiday && holiday.shortDayEndTime && record.checkOut) {
              // Re-verify if they actually left early relative to the SHORT time
              const [hH, hM] = holiday.shortDayEndTime.split(':').map(Number);
              const [cH, cM] = record.checkOut.split(':').map(Number);
              const holidayEndMins = hH * 60 + hM;
              const checkOutMins = cH * 60 + cM;
              
              if (checkOutMins >= holidayEndMins) {
                  effectiveEarlyMinutes = 0; // Forgive early exit on short day
              }
          }

          if (effectiveEarlyMinutes > 0) {
              if (config.attendanceConfig?.earlyExitRules) {
                  const rule = findApplicableRule(effectiveEarlyMinutes, config.attendanceConfig.earlyExitRules);
                  if (rule) {
                      earlyRuleUsage[rule.id] = (earlyRuleUsage[rule.id] || 0) + 1;
                      
                      const exemptionLimit = rule.exemptionsCount || 0;
                      if (earlyRuleUsage[rule.id] > exemptionLimit) {
                          totalEarlyHours += rule.deductionAmount;
                      }
                  }
              }
          }
      }
  });

  const lateDeduction = Math.round(totalLateHours * hourlyRateForDeduction * 100) / 100;
  const earlyDeduction = Math.round(totalEarlyHours * hourlyRateForDeduction * 100) / 100;
  
  // Round amounts
  overtimePay = Math.round(overtimePay * 100) / 100;
  foodingAllowance = Math.round(foodingAllowance * 100) / 100;
  const roundedBasicSalary = Math.round(basicSalary * 100) / 100;
  
  // Gross Salary includes Basic + OT + Fooding
  const grossSalary = roundedBasicSalary + overtimePay + foodingAllowance;

  // 5. Expense Reimbursement
  // Sum of APPROVED claims for this employee in the selected month/year
  let expenseReimbursement = 0;
  if (claims) {
      expenseReimbursement = claims
        .filter(c => {
            const cDate = new Date(c.date);
            const isSameMonth = cDate.toLocaleString('default', { month: 'long' }) === month;
            const isSameYear = cDate.getFullYear() === year;
            return c.employeeId === employee.id && c.status === ClaimStatus.APPROVED && isSameMonth && isSameYear;
        })
        .reduce((sum, c) => sum + c.amount, 0);
  }

  // ESIC is calculated on Gross
  const esicEmployeeShare = Math.round(grossSalary * ESIC_EMPLOYEE_RATE * 100) / 100;
  const esicEmployerShare = Math.round(grossSalary * ESIC_EMPLOYER_RATE * 100) / 100;
  
  // LWF Calculation
  // Rule: 0.2% of Gross, Capped at 34. Employer is twice Employee share.
  let lwfEmployeeShare = 0;
  let lwfEmployerShare = 0;

  if (grossSalary > 0) {
      const calculatedLwf = grossSalary * LWF_EMPLOYEE_RATE;
      lwfEmployeeShare = Math.min(calculatedLwf, LWF_EMPLOYEE_CAP);
      lwfEmployeeShare = Math.round(lwfEmployeeShare * 100) / 100; // Round to 2 decimals

      lwfEmployerShare = lwfEmployeeShare * 2;
      lwfEmployerShare = Math.round(lwfEmployerShare * 100) / 100;
  }
  
  // Calculate Loan Deductions
  const payrollDate = new Date(year, monthIndex, 1);
  
  let totalLoanDeduction = 0;

  loans.filter(l => l.employeeId === employee.id).forEach(loan => {
      const loanDate = new Date(loan.issueDate);
      const loanStartPeriod = new Date(loanDate.getFullYear(), loanDate.getMonth(), 1);
      
      const loanEndPeriod = new Date(loanStartPeriod);
      loanEndPeriod.setMonth(loanEndPeriod.getMonth() + loan.tenureMonths);

      if (payrollDate >= loanStartPeriod && payrollDate < loanEndPeriod) {
          totalLoanDeduction += (loan.amount / loan.tenureMonths);
      }
  });

  totalLoanDeduction = Math.round(totalLoanDeduction * 100) / 100;

  // Net Payable
  const netPayable = grossSalary + expenseReimbursement - lateDeduction - earlyDeduction - esicEmployeeShare - lwfEmployeeShare - totalLoanDeduction;
  const roundedNetPayable = Math.round(netPayable * 100) / 100;

  // Service Charge Calculation (Calculated ON Net Payable)
  const effectiveServiceRate = employee.serviceChargeRate !== undefined ? employee.serviceChargeRate : SERVICE_CHARGE_RATE;
  const serviceCharge = Math.round(roundedNetPayable * effectiveServiceRate * 100) / 100;
  
  return {
    employeeId: employee.id,
    month,
    year,
    daysPresent,
    daysAbsent,
    holidays: totalPaidHolidays,
    totalOvertimeHours,
    totalLateMinutes,
    basicSalary: roundedBasicSalary,
    grossSalary,
    overtimePay,
    foodingAllowance,
    expenseReimbursement,
    esicEmployeeShare,
    esicEmployerShare,
    lwfEmployeeShare,
    lwfEmployerShare,
    serviceCharge,
    loanDeduction: totalLoanDeduction,
    lateDeduction,
    earlyDeduction,
    netPayable: roundedNetPayable
  };
}

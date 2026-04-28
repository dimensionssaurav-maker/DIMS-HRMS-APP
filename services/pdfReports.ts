// PDF report generators for ZenAI voice assistant.
//
// Loads jsPDF + jspdf-autotable from a CDN on first use so the initial bundle
// stays small. Each generator returns the file name it saved to so callers can
// announce it back to the user.

import { Employee, AttendanceRecord, Holiday } from '../types';
type PayrollData = any;

declare global {
  interface Window { jspdf: any; }
}

let jsPDFLoadingPromise: Promise<void> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="' + src + '"]');
    if (existing) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

async function ensureJsPDF(): Promise<void> {
  if ((window as any).jspdf && (window as any).jspdf.jsPDF) return;
  if (jsPDFLoadingPromise) return jsPDFLoadingPromise;
  jsPDFLoadingPromise = (async () => {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.7.0/jspdf.plugin.autotable.min.js');
  })();
  return jsPDFLoadingPromise;
}

// Helpers
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];

function pad2(n: number) { return String(n).padStart(2, '0'); }

function ymd(d: Date) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function daysInMonth(year: number, month0: number) {
  return new Date(year, month0 + 1, 0).getDate();
}

function timeToMinutes(t?: string): number {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function diffHours(checkIn?: string, checkOut?: string): number {
  if (!checkIn || !checkOut) return 0;
  const m = timeToMinutes(checkOut) - timeToMinutes(checkIn);
  return m > 0 ? m / 60 : 0;
}

function addHeader(doc: any, title: string, subtitle: string) {
  doc.setFillColor(79, 70, 229); // indigo-600
  doc.rect(0, 0, 210, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('DIMS HRMS', 14, 13);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 14, 19);
  doc.setFontSize(8);
  doc.text(subtitle, 196, 19, { align: 'right' });
  doc.setTextColor(0, 0, 0);
}

function addFooter(doc: any) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('Generated ' + new Date().toLocaleString() + ' by ZenAI', 14, 290);
    doc.text('Page ' + i + ' of ' + pageCount, 196, 290, { align: 'right' });
  }
}

// ── 1. MONTHLY ATTENDANCE SUMMARY ────────────────────────────────────────────
export async function generateMonthlyAttendancePDF(
  month0: number, year: number,
  employees: Employee[], attendance: AttendanceRecord[], holidays: Holiday[]
): Promise<string> {
  await ensureJsPDF();
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const monthName = MONTH_NAMES[month0];
  addHeader(doc, 'Monthly Attendance Summary', monthName + ' ' + year);

  const days = daysInMonth(year, month0);
  const dateStrs: string[] = [];
  for (let d = 1; d <= days; d++) {
    dateStrs.push(year + '-' + pad2(month0 + 1) + '-' + pad2(d));
  }

  const rows = employees
    .filter(e => e.status === 'Active')
    .map(emp => {
      let p = 0, a = 0, l = 0, h = 0, ot = 0, late = 0;
      dateStrs.forEach(date => {
        const r = attendance.find(x => x.employeeId === emp.id && x.date === date);
        const dayOfWeek = new Date(date).getDay();
        const isSun = dayOfWeek === 0;
        const hol = holidays.find(x => x.date === date);
        if (r) {
          if (r.status === 'PRESENT') p++;
          else if (r.status === 'ABSENT') a++;
          else if (r.status === 'LEAVE') l++;
          else if (r.status === 'HOLIDAY') h++;
          ot += r.overtimeHours || 0;
          if (r.lateMinutes && r.lateMinutes > 0) late++;
        } else if (isSun || (hol && hol.type === 'Full')) {
          h++;
        }
      });
      const daysPaid = p + l + h + (ot > 0 ? ot / 8 : 0);
      const e: any = emp;
      return [
        e.empCode || e.employeeCode || emp.id,
        emp.name,
        emp.department || '',
        String(p),
        String(a),
        String(l),
        String(h),
        ot > 0 ? ot.toFixed(1) : '—',
        String(late),
        daysPaid.toFixed(1).replace('.0', ''),
      ];
    });

  (doc as any).autoTable({
    startY: 28,
    head: [['Code', 'Name', 'Dept', 'P', 'A', 'L', 'H', 'OT', 'Late', 'Paid']],
    body: rows,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 18 }, 1: { cellWidth: 45 }, 2: { cellWidth: 28 },
      3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'center' },
      6: { halign: 'center' }, 7: { halign: 'center' }, 8: { halign: 'center' },
      9: { halign: 'center', fontStyle: 'bold' },
    },
  });

  addFooter(doc);
  const fileName = 'attendance_' + monthName.toLowerCase() + '_' + year + '.pdf';
  doc.save(fileName);
  return fileName;
}

// ── 2. DAILY PUNCH REPORT ────────────────────────────────────────────────────
export async function generateDailyPunchPDF(
  date: string, employees: Employee[], attendance: AttendanceRecord[]
): Promise<string> {
  await ensureJsPDF();
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const d = new Date(date);
  const niceDate = d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  addHeader(doc, 'Daily Punch Report', niceDate);

  const rows = employees
    .filter(e => e.status === 'Active')
    .map(emp => {
      const r = attendance.find(x => x.employeeId === emp.id && x.date === date);
      const hours = diffHours(r?.checkIn, r?.checkOut);
      const e: any = emp;
      return [
        e.empCode || e.employeeCode || emp.id,
        emp.name,
        emp.department || '',
        r?.status || '—',
        r?.checkIn || '—',
        r?.checkOut || '—',
        hours > 0 ? hours.toFixed(2) : '—',
        r?.overtimeHours ? r.overtimeHours.toFixed(1) : '—',
        r?.lateMinutes ? r.lateMinutes + 'm' : '—',
      ];
    });

  (doc as any).autoTable({
    startY: 28,
    head: [['Code', 'Name', 'Dept', 'Status', 'IN', 'OUT', 'Hours', 'OT', 'Late']],
    body: rows,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
  });

  addFooter(doc);
  const fileName = 'daily_punch_' + date + '.pdf';
  doc.save(fileName);
  return fileName;
}

// ── 3. LATE ARRIVALS ─────────────────────────────────────────────────────────
export async function generateLateArrivalsPDF(
  month0: number, year: number,
  employees: Employee[], attendance: AttendanceRecord[]
): Promise<string> {
  await ensureJsPDF();
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const monthName = MONTH_NAMES[month0];
  addHeader(doc, 'Late Arrivals Report', monthName + ' ' + year);

  const days = daysInMonth(year, month0);
  const dateStrs: string[] = [];
  for (let d = 1; d <= days; d++) {
    dateStrs.push(year + '-' + pad2(month0 + 1) + '-' + pad2(d));
  }
  const empById = new Map(employees.map(e => [e.id, e]));

  const rows: any[] = [];
  attendance.forEach(r => {
    if (!dateStrs.includes(r.date)) return;
    if (!r.lateMinutes || r.lateMinutes <= 0) return;
    const emp = empById.get(r.employeeId);
    if (!emp || emp.status !== 'Active') return;
    const e: any = emp;
    rows.push([
      e.empCode || e.employeeCode || emp.id,
      emp.name,
      r.date,
      r.checkIn || '—',
      r.lateMinutes + ' min',
    ]);
  });

  rows.sort((a, b) => a[2].localeCompare(b[2]) || a[1].localeCompare(b[1]));

  (doc as any).autoTable({
    startY: 28,
    head: [['Code', 'Name', 'Date', 'Check-In', 'Late By']],
    body: rows.length > 0 ? rows : [['—', 'No late arrivals in this period', '', '', '']],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' },
  });

  // Summary
  const finalY = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Total late arrivals: ' + rows.length, 14, finalY);

  addFooter(doc);
  const fileName = 'late_arrivals_' + monthName.toLowerCase() + '_' + year + '.pdf';
  doc.save(fileName);
  return fileName;
}

// ── 4. SALARY / PAYROLL ──────────────────────────────────────────────────────
export async function generateSalaryPDF(
  month0: number, year: number,
  employees: Employee[], payroll: PayrollData[]
): Promise<string> {
  await ensureJsPDF();
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const monthName = MONTH_NAMES[month0];
  addHeader(doc, 'Salary / Payroll', monthName + ' ' + year);

  const empById = new Map(employees.map(e => [e.id, e]));
  const rows = payroll.map((p: any) => {
    const emp = empById.get(p.employeeId);
    const deductions = (p.lateDeduction || 0) + (p.earlyDeduction || 0) + (p.loanDeduction || 0)
                     + (p.esicEmployeeShare || 0) + (p.lwfEmployeeShare || 0);
    const e: any = emp;
    return [
      (e && (e.empCode || e.employeeCode)) || p.employeeId,
      emp?.name || '—',
      emp?.department || '',
      String(p.daysPresent || 0),
      (p.basicSalary || 0).toFixed(0),
      (p.overtimePay || 0).toFixed(0),
      deductions.toFixed(0),
      (p.netPayable || 0).toFixed(0),
    ];
  });

  const totalNet = payroll.reduce((s, p) => s + p.netPayable, 0);

  (doc as any).autoTable({
    startY: 28,
    head: [['Code', 'Name', 'Dept', 'Days', 'Base Pay', 'OT', 'Deductions', 'Net Payable']],
    body: rows,
    foot: [['', '', '', '', '', '', 'TOTAL', totalNet.toFixed(0)]],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [243, 244, 246], textColor: 0, fontStyle: 'bold' },
    columnStyles: {
      4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right', fontStyle: 'bold' },
    },
  });

  addFooter(doc);
  const fileName = 'salary_' + monthName.toLowerCase() + '_' + year + '.pdf';
  doc.save(fileName);
  return fileName;
}

// ── INTENT DETECTION ─────────────────────────────────────────────────────────
// Cheap regex/keyword matcher so we don't burn a Gemini call for obvious requests.
// Returns null if no clear intent.

export interface ReportIntent {
  type: 'monthly_attendance' | 'daily_punch' | 'late_arrivals' | 'salary' | 'summary';
  month?: number;   // 0-indexed
  year?: number;
  date?: string;    // YYYY-MM-DD
}

const MONTH_REGEX = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/i;
const MONTH_LOOKUP: Record<string, number> = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
  may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7,
  september: 8, sep: 8, sept: 8, october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11,
};

function parseMonthYear(text: string, todayMonth: number, todayYear: number): { month: number; year: number } {
  const lower = text.toLowerCase();
  let month = todayMonth, year = todayYear;
  const monthMatch = lower.match(MONTH_REGEX);
  if (monthMatch) month = MONTH_LOOKUP[monthMatch[1].toLowerCase()];
  const yearMatch = lower.match(/\b(20\d{2})\b/);
  if (yearMatch) year = parseInt(yearMatch[1], 10);
  // "last month" / "previous month"
  if (/\b(last|previous|prev)\s+month\b/.test(lower)) {
    if (todayMonth === 0) { month = 11; year = todayYear - 1; }
    else { month = todayMonth - 1; year = todayYear; }
  }
  // "this month" / "current month"
  if (/\b(this|current)\s+month\b/.test(lower)) { month = todayMonth; year = todayYear; }
  return { month, year };
}

function parseDate(text: string, todayDate: string): string {
  // Handle "today" / "yesterday" / "DD/MM/YYYY" / "YYYY-MM-DD" / "DD month YYYY"
  const lower = text.toLowerCase();
  if (/\btoday\b/.test(lower)) return todayDate;
  if (/\byesterday\b/.test(lower)) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - 1);
    return ymd(d);
  }
  // YYYY-MM-DD
  let m = lower.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + pad2(parseInt(m[2])) + '-' + pad2(parseInt(m[3]));
  // DD/MM/YYYY or DD-MM-YYYY
  m = lower.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})/);
  if (m) return m[3] + '-' + pad2(parseInt(m[2])) + '-' + pad2(parseInt(m[1]));
  return todayDate;
}

export function detectReportIntent(
  text: string,
  today: Date = new Date()
): ReportIntent | null {
  const lower = text.toLowerCase();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();
  const todayDate = ymd(today);

  // No PDF/report/summary keyword? Not an intent.
  const hasReportKeyword = /\b(report|pdf|generate|download|export|summary|sheet|list)\b/.test(lower);
  if (!hasReportKeyword) return null;

  // Salary / payroll
  if (/\b(salary|payroll|wage|pay\s*slip|payslips?)\b/.test(lower)) {
    const { month, year } = parseMonthYear(text, todayMonth, todayYear);
    return { type: 'salary', month, year };
  }
  // Late arrivals
  if (/\b(late\s+arrival|late\s+in|late\s+report|latecomers?|tardiness|tardy)\b/.test(lower)
      || (/\blate\b/.test(lower) && hasReportKeyword)) {
    const { month, year } = parseMonthYear(text, todayMonth, todayYear);
    return { type: 'late_arrivals', month, year };
  }
  // Daily punch
  if (/\b(daily|today|day)\b/.test(lower) && /\b(punch|attendance|in[\/\s-]?out|present)\b/.test(lower)) {
    const date = parseDate(text, todayDate);
    return { type: 'daily_punch', date };
  }
  // Monthly attendance (default for "attendance report")
  if (/\b(attendance|present|absent)\b/.test(lower)) {
    if (/\b(today|daily)\b/.test(lower)) {
      const date = parseDate(text, todayDate);
      return { type: 'daily_punch', date };
    }
    const { month, year } = parseMonthYear(text, todayMonth, todayYear);
    return { type: 'monthly_attendance', month, year };
  }
  // Generic "summary" -> monthly attendance summary
  if (/\bsummary\b/.test(lower)) {
    const { month, year } = parseMonthYear(text, todayMonth, todayYear);
    return { type: 'summary', month, year };
  }
  return null;
}

import React, { useState } from 'react';
import { FileText, Download, X, ChevronDown, Loader2, CheckCircle2 } from 'lucide-react';
import { Employee, PayrollCalculation, AttendanceRecord, LeaveRequest, Loan, AttendanceStatus } from '../types';

interface Props {
  employees: Employee[];
  payroll: PayrollCalculation[];
  attendance: AttendanceRecord[];
  leaves: LeaveRequest[];
  loans: Loan[];
  selectedMonth: string;
  selectedYear: number;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const PDFReportGenerator: React.FC<Props> = ({
  employees, payroll, attendance, leaves, loans, selectedMonth, selectedYear
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [reportType, setReportType] = useState('payslip');
  const [selectedEmp, setSelectedEmp] = useState('all');
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);

  // ── Core PDF builder using browser print ──────────────────────────────
  const buildAndPrint = (html: string, filename: string) => {
    const win = window.open('', '_blank');
    if (!win) { alert('Please allow popups to generate PDF'); return; }
    win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>${filename}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; background:#fff; }
  .page { width:210mm; min-height:297mm; padding:15mm; margin:0 auto; }
  h1 { font-size:20px; font-weight:800; color:#4f46e5; }
  h2 { font-size:14px; font-weight:700; color:#1e293b; margin:12px 0 6px; }
  h3 { font-size:11px; font-weight:700; color:#475569; margin:8px 0 4px; text-transform:uppercase; letter-spacing:.5px; }
  table { width:100%; border-collapse:collapse; margin-top:6px; }
  th { background:#4f46e5; color:#fff; padding:6px 8px; text-align:left; font-size:10px; font-weight:700; text-transform:uppercase; }
  td { padding:5px 8px; border-bottom:1px solid #e2e8f0; font-size:10px; }
  tr:nth-child(even) td { background:#f8fafc; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #4f46e5; padding-bottom:12px; margin-bottom:16px; }
  .company { }
  .company-name { font-size:18px; font-weight:900; color:#1e293b; }
  .company-sub { font-size:9px; color:#64748b; margin-top:2px; }
  .meta { text-align:right; font-size:10px; color:#64748b; }
  .meta strong { color:#1e293b; }
  .badge { display:inline-block; padding:2px 8px; border-radius:12px; font-size:9px; font-weight:700; }
  .badge-green { background:#dc

// ─── ADD THESE NEW INTERFACES TO types.ts ───────────────────────────────────
// Place these alongside the existing OTRule interface

/**
 * A single time-based OT slab (e.g. Normal OT, Half Night, Full Night)
 * These are stored inside the Shift object so each shift can have its own slabs.
 */
export interface OTSlab {
  id: string;
  name: string;           // e.g. "Normal OT", "Half Night OT", "Full Night OT"
  startTime: string;      // "HH:mm" — 24hr format. Cross-midnight slabs use "00:00" for midnight
  endTime: string;        // "HH:mm"
  multiplier: number;     // Pay rate multiplier e.g. 1.5, 2.0, 2.5
  crossesMidnight: boolean; // true if this slab spans past midnight
  enabled: boolean;
}

// ─── EXTEND THE EXISTING Shift interface ───────────────────────────────────
// Add this optional field to the existing Shift interface in types.ts:
//
//   otSlabs?: OTSlab[];   // Time-based OT slabs for this shift
//
// The full updated Shift interface should look like:
/*
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
  otSlabs?: OTSlab[];    // ← NEW: time-based OT slabs
  sundaySchedule?: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    isFullDayOvertime: boolean;
  };
}
*/

// ─── ADD TO AttendanceRecord interface ────────────────────────────────────
// Add this optional field to AttendanceRecord in types.ts:
//
//   otSlabBreakdown?: OTSlabResult[];  // Per-slab breakdown for this day
//
export interface OTSlabResult {
  slabName: string;
  minutes: number;
  hours: number;
  multiplier: number;
  amount: number;
}

// ─── ADD TO PayrollCalculation interface ──────────────────────────────────
// Add this optional field to PayrollCalculation in types.ts:
//
//   overtimeSlabBreakdown?: {
//     slabName: string;
//     totalHours: number;
//     totalAmount: number;
//   }[];

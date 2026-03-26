/**
 * OT SLAB SECTION — Add this inside ShiftManagement.tsx modal form
 * ─────────────────────────────────────────────────────────────────────────────
 * 
 * STEP 1: Add to imports in ShiftManagement.tsx
 *   import { Plus, Trash2 } from 'lucide-react'; // already imported
 *   import { OTSlab } from '../types';
 *   import { FACTORY_DIMS_DEFAULT_SLABS } from '../utils/otSlabCalculator';
 * 
 * STEP 2: Add otSlabs to formData initial state:
 *   const [formData, setFormData] = useState<Partial<Shift>>({
 *     ...existing fields...,
 *     otSlabs: []  // ← add this
 *   });
 * 
 * STEP 3: Add these helper functions inside the component:
 */

// Helper: add a new empty slab
const addSlab = () => {
  setFormData(prev => ({
    ...prev,
    otSlabs: [
      ...(prev.otSlabs ?? []),
      {
        id: Math.random().toString(36).substr(2, 9),
        name: 'New OT Slab',
        startTime: '18:00',
        endTime: '21:00',
        multiplier: 1.5,
        crossesMidnight: false,
        enabled: true,
      } as OTSlab,
    ],
  }));
};

// Helper: remove a slab
const removeSlab = (id: string) => {
  setFormData(prev => ({ ...prev, otSlabs: (prev.otSlabs ?? []).filter(s => s.id !== id) }));
};

// Helper: update a slab field
const updateSlab = (id: string, field: keyof OTSlab, value: any) => {
  setFormData(prev => ({
    ...prev,
    otSlabs: (prev.otSlabs ?? []).map(s => s.id === id ? { ...s, [field]: value } : s),
  }));
};

// Helper: load factory defaults
const loadFactoryDefaults = () => {
  setFormData(prev => ({ ...prev, otSlabs: FACTORY_DIMS_DEFAULT_SLABS }));
};

/**
 * STEP 4: Add this JSX block INSIDE the modal form, after the Night Shift toggle and before the save button.
 *         Replace the existing JSX comment markers with this block.
 */

const OTSlabsFormSection = (
  <div className="pt-4 border-t border-slate-100">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Clock size={16} className="text-indigo-600" />
        <h4 className="text-sm font-bold text-slate-700">OT Time Slabs</h4>
        <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Optional</span>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={loadFactoryDefaults}
          className="text-xs text-indigo-600 font-bold bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
        >
          Load Factory Defaults
        </button>
        <button
          type="button"
          onClick={addSlab}
          className="text-xs text-white font-bold bg-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1"
        >
          <Plus size={12} /> Add Slab
        </button>
      </div>
    </div>

    {(formData.otSlabs?.length ?? 0) === 0 ? (
      <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
        <p className="text-xs text-slate-400">No OT slabs configured. Add slabs for time-based tiered OT (e.g. Normal OT 1.5x, Half Night 2x, Full Night 2.5x)</p>
        <button type="button" onClick={loadFactoryDefaults} className="mt-2 text-xs text-indigo-600 font-bold underline">
          Load FACTORY DIMS defaults
        </button>
      </div>
    ) : (
      <div className="space-y-3">
        {formData.otSlabs?.map((slab, idx) => (
          <div key={slab.id} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <div className="grid grid-cols-6 gap-2 items-center">
              {/* Slab Name */}
              <div className="col-span-2">
                <label className="text-[10px] text-slate-400 font-medium block mb-1">Slab Name</label>
                <input
                  type="text"
                  value={slab.name}
                  onChange={e => updateSlab(slab.id, 'name', e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:ring-1 focus:ring-indigo-400"
                  placeholder="e.g. Normal OT"
                />
              </div>
              {/* Start Time */}
              <div>
                <label className="text-[10px] text-slate-400 font-medium block mb-1">Start</label>
                <input
                  type="time"
                  value={slab.startTime}
                  onChange={e => updateSlab(slab.id, 'startTime', e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>
              {/* End Time */}
              <div>
                <label className="text-[10px] text-slate-400 font-medium block mb-1">End</label>
                <input
                  type="time"
                  value={slab.endTime}
                  onChange={e => updateSlab(slab.id, 'endTime', e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>
              {/* Multiplier */}
              <div>
                <label className="text-[10px] text-slate-400 font-medium block mb-1">Rate (×)</label>
                <input
                  type="number"
                  value={slab.multiplier}
                  step="0.25"
                  min="1"
                  max="5"
                  onChange={e => updateSlab(slab.id, 'multiplier', parseFloat(e.target.value))}
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>
              {/* Controls */}
              <div className="flex flex-col gap-1.5 items-center">
                <label className="text-[10px] text-slate-400 font-medium">Midnight</label>
                <button
                  type="button"
                  onClick={() => updateSlab(slab.id, 'crossesMidnight', !slab.crossesMidnight)}
                  className={`w-8 h-4 rounded-full transition-colors relative ${slab.crossesMidnight ? 'bg-indigo-500' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${slab.crossesMidnight ? 'left-4' : 'left-0.5'}`} />
                </button>
              </div>
            </div>
            {/* Delete button */}
            <div className="flex justify-between items-center mt-2">
              <span className="text-[10px] text-slate-400">
                {slab.startTime} – {slab.endTime} {slab.crossesMidnight ? '(crosses midnight)' : ''} @ {slab.multiplier}x pay
              </span>
              <button
                type="button"
                onClick={() => removeSlab(slab.id)}
                className="text-[10px] text-red-400 hover:text-red-600 font-bold flex items-center gap-1 transition-colors"
              >
                <Trash2 size={10} /> Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    )}

    {/* Quick preview */}
    {(formData.otSlabs?.length ?? 0) > 0 && (
      <div className="mt-3 p-3 bg-indigo-50 rounded-xl text-xs text-indigo-700">
        <p className="font-bold mb-1">Slab calculation order (starting from shift end {formData.endTime}):</p>
        <div className="flex flex-wrap gap-2">
          {formData.otSlabs?.filter(s => s.enabled).map((s, i) => (
            <span key={i} className="bg-white px-2 py-1 rounded-lg border border-indigo-100 font-medium">
              {i + 1}. {s.name} ({s.startTime}–{s.endTime}) = {s.multiplier}x
            </span>
          ))}
        </div>
      </div>
    )}
  </div>
);

// Export the section so it can be pasted into ShiftManagement modal
export default OTSlabsFormSection;

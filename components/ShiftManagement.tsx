
import React, { useState } from 'react';
import { 
  Clock, 
  MapPin, 
  Zap, 
  Timer, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Sun, 
  Moon, 
  X,
  Check,
  CalendarCheck
} from 'lucide-react';
import { Shift } from '../types';

interface Props {
  shifts: Shift[];
  onAdd: (shift: Shift) => void;
  onUpdate: (shift: Shift) => void;
  onDelete: (id: string) => void;
}

const ShiftManagement: React.FC<Props> = ({ shifts, onAdd, onUpdate, onDelete }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Shift Form Data
  const [formData, setFormData] = useState<Partial<Shift>>({
    name: '',
    site: '',
    startTime: '09:00',
    endTime: '18:00',
    workingHours: 8,
    gracePeriodMinutes: 15,
    breakDurationMinutes: 60,
    overtimeThresholdHours: 8,
    isNightShift: false,
    sundaySchedule: {
        enabled: false,
        startTime: '09:00',
        endTime: '16:00',
        isFullDayOvertime: true
    }
  });

  // Calculate Stats
  const totalShifts = shifts.length;
  const uniqueSites = new Set(shifts.map(s => s.site)).size;
  const avgGrace = Math.round(shifts.reduce((sum, s) => sum + s.gracePeriodMinutes, 0) / totalShifts) || 0;
  const withOTRules = shifts.filter(s => s.overtimeThresholdHours > 0).length;

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const m = parseInt(minutes, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedH = h % 12 || 12;
    return `${formattedH}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const filteredShifts = shifts.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.site.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (shift: Shift) => {
    setFormData({
        ...shift,
        // Ensure sundaySchedule exists if editing old record
        sundaySchedule: shift.sundaySchedule || {
            enabled: false,
            startTime: '09:00',
            endTime: '16:00',
            isFullDayOvertime: true
        }
    });
    setEditingId(shift.id);
    setShowModal(true);
  };

  const handleClose = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData({
        name: '',
        site: '',
        startTime: '09:00',
        endTime: '18:00',
        workingHours: 8,
        gracePeriodMinutes: 15,
        breakDurationMinutes: 60,
        overtimeThresholdHours: 8,
        isNightShift: false,
        sundaySchedule: {
            enabled: false,
            startTime: '09:00',
            endTime: '16:00',
            isFullDayOvertime: true
        }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.site) return;

    if (editingId) {
      onUpdate({ ...formData, id: editingId } as Shift);
    } else {
      onAdd({ 
        ...formData, 
        id: Math.random().toString(36).substr(2, 9) 
      } as Shift);
    }
    handleClose();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">Shift Management</h2>
           <p className="text-slate-500">Configure working hours, grace periods, and Sunday schedules.</p>
        </div>
      </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Clock size={24} />
            </div>
            <div>
                <p className="text-xs font-medium text-slate-500">Total Shifts</p>
                <p className="text-2xl font-bold text-slate-800">{totalShifts}</p>
            </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <MapPin size={24} />
            </div>
            <div>
                <p className="text-xs font-medium text-slate-500">Sites Covered</p>
                <p className="text-2xl font-bold text-slate-800">{uniqueSites}</p>
            </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Timer size={24} />
            </div>
            <div>
                <p className="text-xs font-medium text-slate-500">Avg Grace Period</p>
                <p className="text-2xl font-bold text-slate-800">{avgGrace} min</p>
            </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-violet-50 text-violet-600 rounded-xl">
                <Zap size={24} />
            </div>
            <div>
                <p className="text-xs font-medium text-slate-500">With OT Rules</p>
                <p className="text-2xl font-bold text-slate-800">{withOTRules}</p>
            </div>
            </div>
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-800">Shift Configurations</h3>
            <div className="flex gap-3">
                <button 
                    onClick={() => setShowModal(true)}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-200"
                >
                    <Plus size={16} />
                    Add Shift
                </button>
            </div>
            </div>

            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                <tr className="border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-4 px-2">Shift Name</th>
                    <th className="py-4 px-2">Site</th>
                    <th className="py-4 px-2">Timing</th>
                    <th className="py-4 px-2 text-center">Working Hours</th>
                    <th className="py-4 px-2 text-center">Grace Period</th>
                    <th className="py-4 px-2 text-center">Sunday Rule</th>
                    <th className="py-4 px-2 text-right">Actions</th>
                </tr>
                </thead>
                <tbody className="text-sm">
                {filteredShifts.map(shift => (
                    <tr key={shift.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors group">
                    <td className="py-4 px-2">
                        <div className="flex items-center gap-2 font-bold text-slate-700">
                        {shift.isNightShift ? 
                            <Moon size={16} className="text-violet-500 fill-violet-100" /> : 
                            <Sun size={16} className="text-amber-500 fill-amber-100" />
                        }
                        {shift.name}
                        {shift.isNightShift && (
                            <span className="px-2 py-0.5 bg-slate-800 text-white text-[10px] rounded font-bold uppercase">Night</span>
                        )}
                        </div>
                    </td>
                    <td className="py-4 px-2">
                        <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold border border-slate-200">
                        {shift.site}
                        </span>
                    </td>
                    <td className="py-4 px-2 font-mono font-medium text-slate-600">
                        {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                    </td>
                    <td className="py-4 px-2 text-center">
                        <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded text-xs font-bold">
                        {shift.workingHours}h
                        </span>
                    </td>
                    <td className="py-4 px-2 text-center font-medium text-slate-600">{shift.gracePeriodMinutes} min</td>
                    <td className="py-4 px-2 text-center">
                        {shift.sundaySchedule?.enabled ? (
                            <div className="flex flex-col items-center">
                                <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded border border-orange-200">Working</span>
                                <span className="text-[10px] text-slate-400 mt-0.5">{shift.sundaySchedule.startTime}-{shift.sundaySchedule.endTime}</span>
                            </div>
                        ) : (
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded">Weekly Off</span>
                        )}
                    </td>
                    <td className="py-4 px-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                        <button 
                            onClick={() => handleEdit(shift)}
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                        >
                            <Edit2 size={16} />
                        </button>
                        <button 
                            onClick={() => onDelete(shift.id)}
                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                        >
                            <Trash2 size={16} />
                        </button>
                        </div>
                    </td>
                    </tr>
                ))}
                </tbody>
            </table>
            </div>
        </div>

      {/* Add/Edit Shift Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                 <h3 className="text-lg font-bold text-slate-800">{editingId ? 'Edit Shift Configuration' : 'Create New Shift'}</h3>
                 <button onClick={handleClose} className="p-2 hover:bg-white rounded-full transition-colors">
                   <X size={20} className="text-slate-400" />
                 </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                 {/* ... Shift Form Fields same as before ... */}
                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                       <label className="text-xs font-bold text-slate-500 uppercase">Shift Name</label>
                       <input 
                         type="text" 
                         required
                         value={formData.name}
                         onChange={e => setFormData({...formData, name: e.target.value})}
                         className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none"
                         placeholder="e.g. General Shift"
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-xs font-bold text-slate-500 uppercase">Site / Location</label>
                       <input 
                         type="text" 
                         required
                         value={formData.site}
                         onChange={e => setFormData({...formData, site: e.target.value})}
                         className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none"
                         placeholder="e.g. Chennai Plant"
                       />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="space-y-1">
                       <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                         <Sun size={14} /> Start Time
                       </label>
                       <input 
                         type="time" 
                         required
                         value={formData.startTime}
                         onChange={e => setFormData({...formData, startTime: e.target.value})}
                         className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                         <Moon size={14} /> End Time
                       </label>
                       <input 
                         type="time" 
                         required
                         value={formData.endTime}
                         onChange={e => setFormData({...formData, endTime: e.target.value})}
                         className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                       />
                    </div>
                 </div>

                 <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-1">
                       <label className="text-[10px] font-bold text-slate-500 uppercase">Work Hrs</label>
                       <input 
                         type="number"
                         step="0.5"
                         value={formData.workingHours}
                         onChange={e => setFormData({...formData, workingHours: Number(e.target.value)})}
                         className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none font-bold text-center"
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-bold text-slate-500 uppercase">Grace (Min)</label>
                       <input 
                         type="number"
                         value={formData.gracePeriodMinutes}
                         onChange={e => setFormData({...formData, gracePeriodMinutes: Number(e.target.value)})}
                         className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none font-bold text-center"
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-bold text-slate-500 uppercase">Break (Min)</label>
                       <input 
                         type="number"
                         value={formData.breakDurationMinutes}
                         onChange={e => setFormData({...formData, breakDurationMinutes: Number(e.target.value)})}
                         className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none font-bold text-center"
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-bold text-slate-500 uppercase">OT After (Hr)</label>
                       <input 
                         type="number"
                         step="0.5"
                         value={formData.overtimeThresholdHours}
                         onChange={e => setFormData({...formData, overtimeThresholdHours: Number(e.target.value)})}
                         className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none font-bold text-center"
                       />
                    </div>
                 </div>

                 {/* SUNDAY SCHEDULE SECTION */}
                 <div className="border-t border-slate-100 pt-6">
                    <div className="flex items-center justify-between mb-4">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <CalendarCheck size={16} className="text-orange-500" />
                            Sunday Schedule
                        </label>
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button
                                type="button" 
                                onClick={() => setFormData({...formData, sundaySchedule: { ...formData.sundaySchedule!, enabled: false }})}
                                className={`px-3 py-1 text-xs font-bold rounded transition-all ${!formData.sundaySchedule?.enabled ? 'bg-white shadow text-slate-700' : 'text-slate-400'}`}
                            >
                                Weekly Off
                            </button>
                            <button
                                type="button" 
                                onClick={() => setFormData({...formData, sundaySchedule: { ...formData.sundaySchedule!, enabled: true }})}
                                className={`px-3 py-1 text-xs font-bold rounded transition-all ${formData.sundaySchedule?.enabled ? 'bg-orange-500 shadow text-white' : 'text-slate-400'}`}
                            >
                                Working Day
                            </button>
                        </div>
                    </div>

                    {formData.sundaySchedule?.enabled && (
                        <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 animate-in fade-in slide-in-from-top-2">
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-orange-700 uppercase">Start Time</label>
                                    <input 
                                        type="time"
                                        value={formData.sundaySchedule.startTime}
                                        onChange={(e) => setFormData({
                                            ...formData, 
                                            sundaySchedule: { ...formData.sundaySchedule!, startTime: e.target.value }
                                        })}
                                        className="w-full bg-white border border-orange-200 rounded-xl px-3 py-2 text-sm font-bold outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-orange-700 uppercase">End Time</label>
                                    <input 
                                        type="time"
                                        value={formData.sundaySchedule.endTime}
                                        onChange={(e) => setFormData({
                                            ...formData, 
                                            sundaySchedule: { ...formData.sundaySchedule!, endTime: e.target.value }
                                        })}
                                        className="w-full bg-white border border-orange-200 rounded-xl px-3 py-2 text-sm font-bold outline-none"
                                    />
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <input 
                                    type="checkbox"
                                    id="fullOt"
                                    checked={formData.sundaySchedule.isFullDayOvertime}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        sundaySchedule: { ...formData.sundaySchedule!, isFullDayOvertime: e.target.checked }
                                    })}
                                    className="w-4 h-4 text-orange-600 rounded border-orange-300 focus:ring-orange-500"
                                />
                                <label htmlFor="fullOt" className="text-xs font-bold text-orange-800">
                                    Treat as Full Day Overtime (All hours worked are OT)
                                </label>
                            </div>
                        </div>
                    )}
                 </div>

                 <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                    <button 
                       type="button"
                       onClick={() => setFormData({...formData, isNightShift: !formData.isNightShift})}
                       className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                         formData.isNightShift 
                           ? 'bg-slate-800 text-white border-slate-800 shadow-lg' 
                           : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                       }`}
                    >
                       {formData.isNightShift ? <Check size={18} /> : <Moon size={18} />}
                       <span className="font-bold text-sm">Night Shift</span>
                    </button>
                    <div className="flex-1"></div>
                 </div>

                 <div className="pt-4 flex gap-3">
                    <button 
                      type="button"
                      onClick={handleClose}
                      className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-700"
                    >
                      {editingId ? 'Update Configuration' : 'Create Shift'}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default ShiftManagement;

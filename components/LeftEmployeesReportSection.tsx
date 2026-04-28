
import React, { useMemo } from 'react';
import { UserX, Search, Building2 } from 'lucide-react';
import { Employee } from '../types';

interface Props {
  employees: Employee[];
}

const LeftEmployeesReportSection: React.FC<Props> = ({ employees }) => {
  const leftEmployees = useMemo(() => {
    return employees
      .filter(e => e.status === 'Left')
      .sort((a, b) => new Date(b.leavingDate || '').getTime() - new Date(a.leavingDate || '').getTime());
  }, [employees]);

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
            <UserX size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">Ex-Employee Register</h3>
            <p className="text-sm text-slate-500">
              List of employees who have left the organization.
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-xs font-bold text-slate-500 uppercase border-b border-slate-100 bg-slate-50">
              <th className="px-6 py-4">Employee</th>
              <th className="px-6 py-4">Department</th>
              <th className="px-6 py-4">Designation</th>
              <th className="px-6 py-4">Leaving Date</th>
              <th className="px-6 py-4 text-right">Tenure</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-sm">
            {leftEmployees.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                  No records of left employees found.
                </td>
              </tr>
            ) : (
              leftEmployees.map((emp) => {
                const joinDate = new Date(emp.joiningDate);
                const leaveDate = emp.leavingDate ? new Date(emp.leavingDate) : new Date();
                const diffTime = Math.abs(leaveDate.getTime() - joinDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                
                const years = Math.floor(diffDays / 365);
                const months = Math.floor((diffDays % 365) / 30);
                
                const tenure = years > 0 
                    ? `${years} yr ${months} mo` 
                    : `${months} months`;

                return (
                  <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold grayscale">
                          {emp.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-700">{emp.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{emp.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                            <Building2 size={14} className="text-slate-300" />
                            <span className="text-slate-600">{emp.department}</span>
                        </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                        {emp.designation}
                    </td>
                    <td className="px-6 py-4 font-mono font-medium text-slate-700">
                        {emp.leavingDate || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-right">
                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold border border-slate-200">
                            {tenure}
                        </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LeftEmployeesReportSection;

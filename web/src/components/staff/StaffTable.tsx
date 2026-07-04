import { Staff } from "@/types/staff";
import { Edit, Trash2, Smartphone } from "lucide-react";

interface StaffTableProps {
  staffList: Staff[];
  onEdit: (staff: Staff) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (staff: Staff) => void;
  onResetDevice: (id: string) => void;
}

export default function StaffTable({ staffList, onEdit, onDelete, onToggleStatus, onResetDevice }: StaffTableProps) {
  if (staffList.length === 0) {
    return (
      <div className="text-center py-16 glass-effect-dark-card rounded-3xl border border-dashed border-slate-700/30 shadow-xl">
        <p className="text-slate-500 font-semibold">Belum ada data Petugas OSIS.</p>
      </div>
    );
  }

  return (
    <div className="glass-effect-dark-card rounded-3xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-700/30">
          <thead className="bg-gradient-to-r from-slate-900/70 to-slate-900/50">
            <tr>
              <th className="px-8 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Nama Lengkap</th>
              <th className="px-8 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Username</th>
              <th className="px-8 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Password</th>
              <th className="px-8 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Perangkat</th>
              <th className="px-8 py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
              <th className="px-8 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-slate-900/30 divide-y divide-slate-700/30">
            {staffList.map((staff) => (
              <tr key={staff.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-8 py-5 whitespace-nowrap">
                  <div className="text-sm font-semibold text-slate-100">{staff.name}</div>
                </td>
                <td className="px-8 py-5 whitespace-nowrap">
                  <div className="text-sm text-slate-300">{staff.username}</div>
                </td>
                <td className="px-8 py-5 whitespace-nowrap">
                  <div className="text-sm font-mono text-slate-500">••••••</div>
                </td>
                <td className="px-8 py-5 whitespace-nowrap">
                  <div className="text-sm">
                    {staff.deviceId ? (
                      <span className="text-green-400 flex items-center gap-2 font-semibold">
                        <Smartphone size={16} /> Terhubung
                      </span>
                    ) : (
                      <span className="text-slate-500 italic">Belum ada</span>
                    )}
                  </div>
                </td>
                <td className="px-8 py-5 whitespace-nowrap text-center">
                  <button 
                      onClick={() => onToggleStatus(staff)}
                      className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold ring-1 ring-inset ${
                          staff.isActive 
                            ? 'bg-green-900/30 text-green-300 ring-green-700/30' 
                            : 'bg-red-900/30 text-red-300 ring-red-700/30'
                      }`}
                  >
                      {staff.isActive ? 'Aktif' : 'Non-Aktif'}
                  </button>
                </td>
                <td className="px-8 py-5 whitespace-nowrap text-right flex items-center justify-end gap-2">
                  <button
                    onClick={() => onResetDevice(staff.id)}
                    className={`p-2 rounded-xl transition-all ${
                      !staff.deviceId 
                        ? 'opacity-30 cursor-not-allowed text-slate-500' 
                        : 'text-orange-400 hover:text-orange-300 hover:bg-orange-900/30'
                    }`}
                    title="Reset Device"
                    disabled={!staff.deviceId}
                  >
                    <Smartphone size={20} />
                  </button>
                  <button
                    onClick={() => onEdit(staff)}
                    className="p-2 rounded-xl text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 transition-all"
                    title="Edit"
                  >
                    <Edit size={20} />
                  </button>
                  <button
                    onClick={() => onDelete(staff.id)}
                    className="p-2 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-900/30 transition-all"
                    title="Hapus"
                  >
                    <Trash2 size={20} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

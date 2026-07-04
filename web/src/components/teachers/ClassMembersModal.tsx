import { X, User } from "lucide-react";
import { useStudentStore } from "@/store/useStudentStore";

interface ClassMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  className: string;
  teacherName: string;
}

export default function ClassMembersModal({ isOpen, onClose, className, teacherName }: ClassMembersModalProps) {
  const { students } = useStudentStore();
  
  const classMembers = students.filter(
    (student) => student.class === className
  ).sort((a, b) => a.name.localeCompare(b.name));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl glass-effect-dark p-6 shadow-2xl border border-slate-700/50 max-h-[80vh] flex flex-col">
        <div className="mb-4 flex items-center justify-between border-b border-slate-700 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Daftar Anggota Kelas {className}</h2>
            <p className="text-sm text-slate-400">Wali Kelas: {teacherName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1 hover:bg-slate-800 rounded-full transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {classMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <User className="mb-2 h-12 w-12 opacity-20" />
              <p>Belum ada siswa di kelas ini.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-700">
              <thead className="bg-slate-800/50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                    No
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                    NISN
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                    Nama Siswa
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                    L/P
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {classMembers.map((student, index) => (
                  <tr key={student.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-400">
                      {index + 1}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-100">
                      {student.nisn}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-100">
                      {student.name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-400">
                      {student.gender}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-4 flex justify-end border-t border-slate-700 pt-4">
          <button
            onClick={onClose}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

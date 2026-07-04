import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Teacher } from "@/types/teacher";
import { useClassStore } from "@/store/useClassStore";
import { useTeacherStore } from "@/store/useTeacherStore";

interface TeacherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Teacher, "id">) => void;
  initialData?: Teacher | null;
}

export default function TeacherModal({ isOpen, onClose, onSubmit, initialData }: TeacherModalProps) {
  const { classes } = useClassStore();
  const { teachers } = useTeacherStore();
  const [formData, setFormData] = useState<Partial<Teacher>>({
    name: "",
    homeroomClass: "",
    phone: "",
    email: "",
    status: "active",
  });

  // Calculate taken classes
  const takenClasses = teachers.reduce((acc, teacher) => {
    // Skip the current teacher if editing
    if (initialData && teacher.id === initialData.id) return acc;
    
    if (teacher.homeroomClass) {
      acc[teacher.homeroomClass] = teacher.name;
    }
    return acc;
  }, {} as Record<string, string>);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        nuptk: "",
        name: "",
        homeroomClass: "",
        phone: "",
        email: "",
        status: "active",
      });
    }
  }, [initialData, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.nuptk) return;

    const submitData = {
      ...formData,
    } as Omit<Teacher, "id">;

    onSubmit(submitData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl glass-effect-dark p-6 shadow-2xl border border-slate-700/50">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-100">
            {initialData ? "Edit Guru" : "Tambah Guru Baru"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1 hover:bg-slate-800 rounded-full transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300">NUPTK (Password Login)</label>
            <input
              type="text"
              name="nuptk"
              required
              value={formData.nuptk || ""}
              onChange={handleChange}
              placeholder="Isi NUPTK guru sebagai password login awal"
              className="mt-1 block w-full rounded-md border border-slate-700 px-3 py-2 text-slate-100 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm bg-slate-900/50"
            />
            <p className="mt-2 text-xs text-slate-400">NUPTK dipakai sebagai password login awal guru.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300">Nama Guru (Username Login)</label>
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              placeholder="Isi nama guru sesuai username login"
              className="mt-1 block w-full rounded-md border border-slate-700 px-3 py-2 text-slate-100 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm bg-slate-900/50"
            />
            <p className="mt-2 text-xs text-slate-400">Nama guru dipakai sebagai username login.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300">Kelas Wali</label>
            <select
              name="homeroomClass"
              value={formData.homeroomClass}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-slate-700 px-3 py-2 text-slate-100 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm bg-slate-900/50"
            >
              <option value="">Bukan Wali Kelas</option>
              {classes.map((cls) => {
                const isTaken = takenClasses[cls.name];
                return (
                  <option 
                    key={cls.id} 
                    value={cls.name}
                    disabled={!!isTaken}
                    className="text-slate-100 bg-slate-900"
                  >
                    {cls.name} {isTaken ? `(Diampu oleh ${isTaken})` : ""}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300">No HP</label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-slate-700 px-3 py-2 text-slate-100 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm bg-slate-900/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-slate-700 px-3 py-2 text-slate-100 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm bg-slate-900/50"
              >
                <option value="active" className="text-slate-100 bg-slate-900">Aktif</option>
                <option value="inactive" className="text-slate-100 bg-slate-900">Tidak Aktif</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300">Email (Opsional)</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-slate-700 px-3 py-2 text-slate-100 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm bg-slate-900/50"
            />
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 shadow-sm hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="rounded-md bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 text-sm font-medium text-white shadow-lg hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all"
            >
              {initialData ? "Simpan Perubahan" : "Tambah Guru"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

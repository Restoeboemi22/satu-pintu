import { useState, useEffect } from "react";
import { Staff } from "@/types/staff";
import { X, Save, Eye, EyeOff } from "lucide-react";

interface StaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (staff: Omit<Staff, "id"> | Staff) => Promise<void>;
  initialData: Staff | null;
}

export default function StaffModal({ isOpen, onClose, onSave, initialData }: StaffModalProps) {
  const [formData, setFormData] = useState<Partial<Staff>>({
    name: "",
    username: "",
    password: "",
    role: "staff",
    isActive: true
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        name: "",
        username: "",
        password: "",
        role: "staff",
        isActive: true
      });
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.username || !formData.password) return;

    setIsSubmitting(true);
    try {
      await onSave(formData as Staff);
      onClose();
    } catch (error) {
      console.error(error);
      alert("Gagal menyimpan data");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-effect-dark-card rounded-3xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex justify-between items-center p-8 border-b border-slate-700/30">
          <h2 className="text-2xl font-black text-slate-100">
            {initialData ? "Edit Petugas OSIS" : "Tambah Petugas OSIS"}
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-all">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">Nama Lengkap</label>
            <input
              type="text"
              required
              className="w-full px-4 py-3 border border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-100 bg-slate-900/60 shadow-sm transition-all"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Contoh: Ahmad Staff"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">Username (Login)</label>
            <input
              type="text"
              required
              className="w-full px-4 py-3 border border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-100 bg-slate-900/60 shadow-sm transition-all"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, '_') })}
              placeholder="Contoh: osis_gerbang_1"
            />
            <p className="text-xs text-slate-500 mt-2">Gunakan huruf kecil dan underscore, tanpa spasi.</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                className="w-full px-4 py-3 border border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-12 text-slate-100 bg-slate-900/60 shadow-sm transition-all"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Minimal 6 karakter"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div className="flex items-center mt-2">
            <input
              id="isActive"
              type="checkbox"
              className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-slate-700 rounded bg-slate-900"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            />
            <label htmlFor="isActive" className="ml-3 block text-sm font-semibold text-slate-200">
              Akun Aktif
            </label>
          </div>

          <div className="flex justify-end pt-6 space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-slate-700 rounded-xl text-slate-300 hover:bg-slate-800 font-semibold transition-all shadow-sm"
              disabled={isSubmitting}
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-700 text-white rounded-xl hover:shadow-lg hover:shadow-indigo-500/30 disabled:opacity-50 font-semibold transition-all"
              disabled={isSubmitting}
            >
              <Save size={20} />
              {isSubmitting ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

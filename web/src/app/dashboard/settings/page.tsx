"use client";

import { useState } from "react";
import { useSettingsStore, AcademicYear } from "@/store/useSettingsStore";
import { Save, Plus, Trash2, Check, School, Calendar, UserCog } from "lucide-react";

export default function SettingsPage() {
  const { 
    schoolIdentity, 
    updateSchoolIdentity, 
    academicYears, 
    activeYearId, 
    setActiveYear, 
    addAcademicYear, 
    deleteAcademicYear 
  } = useSettingsStore();

  const [activeTab, setActiveTab] = useState<'identity' | 'academic' | 'account'>('identity');
  const [isEditingIdentity, setIsEditingIdentity] = useState(false);
  const [identityForm, setIdentityForm] = useState(schoolIdentity);

  // Identity Handlers
  const handleIdentitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSchoolIdentity(identityForm);
    setIsEditingIdentity(false);
  };

  // Academic Year Handlers
  const [newYearForm, setNewYearForm] = useState<Partial<AcademicYear>>({
    name: "",
    semester: "Ganjil",
    startDate: "",
    endDate: ""
  });
  const [isAddingYear, setIsAddingYear] = useState(false);

  const handleAddYear = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newYearForm.name || !newYearForm.startDate || !newYearForm.endDate) return;

    addAcademicYear({
      id: Math.random().toString(36).substr(2, 9),
      name: newYearForm.name!,
      semester: newYearForm.semester as 'Ganjil' | 'Genap',
      isActive: false,
      startDate: newYearForm.startDate!,
      endDate: newYearForm.endDate!
    });
    setNewYearForm({ name: "", semester: "Ganjil", startDate: "", endDate: "" });
    setIsAddingYear(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Pengaturan Sistem</h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('identity')}
            className={`${
              activeTab === 'identity'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:border-slate-600 hover:text-slate-300'
            } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium flex items-center gap-2`}
          >
            <School className="h-4 w-4" />
            Identitas Sekolah
          </button>
          <button
            onClick={() => setActiveTab('academic')}
            className={`${
              activeTab === 'academic'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:border-slate-600 hover:text-slate-300'
            } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium flex items-center gap-2`}
          >
            <Calendar className="h-4 w-4" />
            Tahun Ajaran
          </button>
          <button
            onClick={() => setActiveTab('account')}
            className={`${
              activeTab === 'account'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:border-slate-600 hover:text-slate-300'
            } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium flex items-center gap-2`}
          >
            <UserCog className="h-4 w-4" />
            Akun Admin
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="mt-6">
        {/* Identitas Sekolah */}
        {activeTab === 'identity' && (
          <div className="glass-effect-dark-card rounded-xl">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium leading-6 text-slate-100">Profil Sekolah</h3>
                {!isEditingIdentity ? (
                  <button
                    onClick={() => {
                      setIdentityForm(schoolIdentity);
                      setIsEditingIdentity(true);
                    }}
                    className="inline-flex items-center rounded-md border border-slate-600 bg-slate-800/50 px-3 py-2 text-sm font-medium text-slate-200 shadow-sm hover:bg-slate-700/50 focus:outline-none"
                  >
                    Edit Data
                  </button>
                ) : (
                  <button
                    onClick={() => setIsEditingIdentity(false)}
                    className="text-sm text-slate-400 hover:text-slate-300"
                  >
                    Batal
                  </button>
                )}
              </div>

              {isEditingIdentity ? (
                <form onSubmit={handleIdentitySubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-300">Nama Sekolah</label>
                      <input
                        type="text"
                        value={identityForm.name}
                        onChange={(e) => setIdentityForm({...identityForm, name: e.target.value})}
                        className="mt-1 block w-full rounded-md border border-slate-600 bg-slate-800/50 px-3 py-2 text-slate-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300">No. Telepon</label>
                      <input
                        type="text"
                        value={identityForm.phone}
                        onChange={(e) => setIdentityForm({...identityForm, phone: e.target.value})}
                        className="mt-1 block w-full rounded-md border border-slate-600 bg-slate-800/50 px-3 py-2 text-slate-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-slate-300">Alamat</label>
                      <textarea
                        value={identityForm.address}
                        onChange={(e) => setIdentityForm({...identityForm, address: e.target.value})}
                        rows={3}
                        className="mt-1 block w-full rounded-md border border-slate-600 bg-slate-800/50 px-3 py-2 text-slate-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300">Email</label>
                      <input
                        type="email"
                        value={identityForm.email}
                        onChange={(e) => setIdentityForm({...identityForm, email: e.target.value})}
                        className="mt-1 block w-full rounded-md border border-slate-600 bg-slate-800/50 px-3 py-2 text-slate-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300">Website</label>
                      <input
                        type="text"
                        value={identityForm.website}
                        onChange={(e) => setIdentityForm({...identityForm, website: e.target.value})}
                        className="mt-1 block w-full rounded-md border border-slate-600 bg-slate-800/50 px-3 py-2 text-slate-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-4">
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded-md border border-transparent bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Simpan Perubahan
                    </button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
                  <div>
                    <dt className="font-medium text-slate-400">Nama Sekolah</dt>
                    <dd className="mt-1 text-slate-100">{schoolIdentity.name}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-400">No. Telepon</dt>
                    <dd className="mt-1 text-slate-100">{schoolIdentity.phone}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="font-medium text-slate-400">Alamat</dt>
                    <dd className="mt-1 text-slate-100">{schoolIdentity.address}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-400">Email</dt>
                    <dd className="mt-1 text-slate-100">{schoolIdentity.email}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-400">Website</dt>
                    <dd className="mt-1 text-slate-100">{schoolIdentity.website}</dd>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tahun Ajaran */}
        {activeTab === 'academic' && (
          <div className="glass-effect-dark-card rounded-xl">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium leading-6 text-slate-100">Daftar Tahun Ajaran</h3>
                <button
                  onClick={() => setIsAddingYear(!isAddingYear)}
                  className="inline-flex items-center rounded-md border border-transparent bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:from-blue-700 hover:to-indigo-700"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Tambah Tahun Ajaran
                </button>
              </div>

              {isAddingYear && (
                <div className="mb-6 bg-slate-800/30 p-4 rounded-md border border-slate-700">
                  <h4 className="text-sm font-medium text-slate-100 mb-3">Form Tahun Ajaran Baru</h4>
                  <form onSubmit={handleAddYear} className="grid grid-cols-1 gap-4 sm:grid-cols-5 items-end">
                    <div className="sm:col-span-1">
                      <label className="block text-xs font-medium text-slate-300 mb-1">Tahun (Misal: 2025/2026)</label>
                      <input
                        type="text"
                        required
                        placeholder="2025/2026"
                        value={newYearForm.name}
                        onChange={(e) => setNewYearForm({...newYearForm, name: e.target.value})}
                        className="block w-full rounded-md border border-slate-600 bg-slate-800/50 px-3 py-2 text-slate-100 text-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-xs font-medium text-slate-300 mb-1">Semester</label>
                      <select
                        value={newYearForm.semester}
                        onChange={(e) => setNewYearForm({...newYearForm, semester: e.target.value as 'Ganjil' | 'Genap'})}
                        className="block w-full rounded-md border border-slate-600 bg-slate-800/50 px-3 py-2 text-slate-100 text-sm focus:border-blue-500 focus:ring-blue-500"
                      >
                        <option value="Ganjil">Ganjil</option>
                        <option value="Genap">Genap</option>
                      </select>
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-xs font-medium text-slate-300 mb-1">Tanggal Mulai</label>
                      <input
                        type="date"
                        required
                        value={newYearForm.startDate}
                        onChange={(e) => setNewYearForm({...newYearForm, startDate: e.target.value})}
                        className="block w-full rounded-md border border-slate-600 bg-slate-800/50 px-3 py-2 text-slate-100 text-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-xs font-medium text-slate-300 mb-1">Tanggal Selesai</label>
                      <input
                        type="date"
                        required
                        value={newYearForm.endDate}
                        onChange={(e) => setNewYearForm({...newYearForm, endDate: e.target.value})}
                        className="block w-full rounded-md border border-slate-600 bg-slate-800/50 px-3 py-2 text-slate-100 text-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div className="sm:col-span-1 flex gap-2">
                      <button
                        type="submit"
                        className="w-full rounded-md bg-gradient-to-r from-green-600 to-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:from-green-700 hover:to-emerald-700"
                      >
                        Simpan
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAddingYear(false)}
                        className="w-full rounded-md bg-slate-800/50 border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/50"
                      >
                        Batal
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="overflow-hidden shadow ring-1 ring-slate-700 md:rounded-lg">
                <table className="min-w-full divide-y divide-slate-700">
                  <thead className="bg-slate-800/50">
                    <tr>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-100">Tahun Ajaran</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-100">Semester</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-100">Periode</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-100">Status</th>
                      <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700 bg-slate-800/30">
                    {academicYears.map((year) => (
                      <tr key={year.id} className={year.id === activeYearId ? 'bg-blue-900/20' : ''}>
                        <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-slate-100">{year.name}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-400">{year.semester}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-400">
                          {new Date(year.startDate).toLocaleDateString('id-ID')} - {new Date(year.endDate).toLocaleDateString('id-ID')}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-400">
                          {year.id === activeYearId ? (
                            <span className="inline-flex items-center rounded-full bg-green-900/30 border border-green-600 px-2.5 py-0.5 text-xs font-medium text-green-400">
                              Aktif
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-slate-800/30 border border-slate-600 px-2.5 py-0.5 text-xs font-medium text-slate-400">
                              Tidak Aktif
                            </span>
                          )}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <div className="flex justify-end gap-2">
                            {year.id !== activeYearId && (
                              <>
                                <button
                                  onClick={() => setActiveYear(year.id)}
                                  className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                  title="Aktifkan"
                                >
                                  <Check className="h-4 w-4" />
                                  <span className="sr-only">Aktifkan</span>
                                </button>
                                <button
                                  onClick={() => deleteAcademicYear(year.id)}
                                  className="text-red-400 hover:text-red-300"
                                  title="Hapus"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Hapus</span>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Akun Admin */}
        {activeTab === 'account' && (
          <div className="glass-effect-dark-card rounded-xl">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium leading-6 text-slate-100 mb-4">Keamanan Akun</h3>
              <div className="max-w-xl">
                <div className="rounded-md bg-yellow-900/30 border border-yellow-600/50 p-4 mb-6">
                  <div className="flex">
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-300">Perhatian</h3>
                      <div className="mt-2 text-sm text-yellow-400">
                        <p>
                          Saat ini fitur manajemen akun admin masih dalam tahap pengembangan.
                          Password default admin adalah: <code className="bg-slate-800 px-1 rounded">admin123</code>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <form className="space-y-4 opacity-50 pointer-events-none">
                  <div>
                    <label className="block text-sm font-medium text-slate-300">Password Lama</label>
                    <input
                      type="password"
                      className="mt-1 block w-full rounded-md border border-slate-600 bg-slate-800/50 px-3 py-2 text-slate-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">Password Baru</label>
                    <input
                      type="password"
                      className="mt-1 block w-full rounded-md border border-slate-600 bg-slate-800/50 px-3 py-2 text-slate-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300">Konfirmasi Password Baru</label>
                    <input
                      type="password"
                      className="mt-1 block w-full rounded-md border border-slate-600 bg-slate-800/50 px-3 py-2 text-slate-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Update Password
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

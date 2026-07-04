"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useNotificationStore, NotificationTargetType } from '@/store/useNotificationStore';
import { useClassStore } from '@/store/useClassStore';
import { useStudentStore } from '@/store/useStudentStore';
import { useAuthStore } from '@/store/useAuthStore';
import { Send, Bell, Trash2, History, Users, School, GraduationCap, CheckCircle, User, ArrowLeft } from 'lucide-react';

export default function NotificationsPage() {
  const router = useRouter();
  const { notifications = [], sendNotification, deleteNotification, clearHistory, isLoading, initNotificationSync } = useNotificationStore();
  const { classes } = useClassStore();
  const { students } = useStudentStore();
  const { user } = useAuthStore();

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState<NotificationTargetType>('TEACHERS');
  const [targetValue, setTargetValue] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  const normalizeIdentity = (value: unknown) => String(value || "").trim();

  // Init Sync
  useEffect(() => {
    const unsubscribe = initNotificationSync(user?.schoolId);
    return () => unsubscribe();
  }, [initNotificationSync, user?.schoolId]);

  const normalize = (value: unknown) => String(value || "").trim().toLowerCase();

  const scopedStudents = useMemo(() => {
    const sid = normalize(user?.schoolId);
    if (!sid) return students;
    return students.filter((student) => normalize((student as any)?.schoolId) === sid);
  }, [students, user?.schoolId]);

  // Filtered students for search
  const filteredStudents = useMemo(() => {
    const query = studentSearch.toLowerCase();
    return scopedStudents
      .filter((s) =>
        (s.name || "").toLowerCase().includes(query) ||
        (s.nisn || "").includes(studentSearch) ||
        (s.class || "").toLowerCase().includes(query)
      )
      .slice(0, 10);
  }, [scopedStudents, studentSearch]);

  // Teacher View (APK Style)
  if (user?.role === 'teacher') {
    const teacherNotifications = notifications.filter((notification) => notification.targetType === 'TEACHERS');

    return (
      <div className="min-h-screen bg-slate-900/30 -mx-4 -mt-4 sm:-mx-8 sm:-mt-8">
        {/* Header */}
        <div className="bg-blue-600 px-4 py-4 shadow-md flex items-center text-white">
          <button onClick={() => router.back()} className="mr-4">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">Notifikasi</h1>
        </div>

        {/* Content */}
        <div className="p-4">
          {teacherNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[70vh] text-center">
              <Bell className="w-16 h-16 text-gray-400 mb-4" />
              <p className="text-slate-400 font-medium">Tidak ada notifikasi baru</p>
            </div>
          ) : (
            <div className="space-y-3">
              {teacherNotifications.map((notif) => (
                <div key={notif.id} className="glass-effect-dark-card p-4 rounded-lg shadow-sm border border-slate-700">
                  <div className="flex justify-between items-start mb-2">
                     <h3 className="font-bold text-slate-100">{notif.title}</h3>
                     <span className="text-xs text-gray-400">
                        {new Date(notif.sentAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                     </span>
                  </div>
                  <p className="text-sm text-slate-400 line-clamp-3">{notif.message}</p>
                  <div className="mt-2 text-xs text-blue-600 font-medium">
                    Dari: {notif.senderName}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Student View
  if (user?.role === 'student') {
    const myNotifications = notifications.filter(n => {
        if (n.targetType === 'ALL_CLASSES' || n.targetType === 'STUDENTS') return true;
        if (n.targetType === 'CLASS' && normalizeIdentity(n.targetValue) === normalizeIdentity(user.class)) return true;
        if (
          n.targetType === 'SPECIFIC_STUDENT' &&
          [normalizeIdentity(user.id), normalizeIdentity(user.nisn)]
            .filter(Boolean)
            .includes(normalizeIdentity(n.targetValue))
        ) return true;
        return false;
    });

    return (
      <div className="min-h-screen bg-slate-900/30 -mx-4 -mt-4 sm:-mx-8 sm:-mt-8">
        {/* Header */}
        <div className="bg-blue-600 px-4 py-4 shadow-md flex items-center text-white">
          <button onClick={() => router.back()} className="mr-4">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">Notifikasi Saya</h1>
        </div>

        {/* Content */}
        <div className="p-4">
          {myNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[70vh] text-center">
              <Bell className="w-16 h-16 text-gray-400 mb-4" />
              <p className="text-slate-400 font-medium">Tidak ada notifikasi baru</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myNotifications.map((notif) => (
                <div key={notif.id} className="glass-effect-dark-card p-4 rounded-lg shadow-sm border border-slate-700">
                  <div className="flex justify-between items-start mb-2">
                     <h3 className="font-bold text-slate-100">{notif.title}</h3>
                     <span className="text-xs text-gray-400">
                        {new Date(notif.sentAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                     </span>
                  </div>
                  <p className="text-sm text-slate-400 line-clamp-3">{notif.message}</p>
                  <div className="mt-2 text-xs text-blue-600 font-medium">
                    Dari: {notif.senderName}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    if (targetType === 'CLASS' && !targetValue) {
      alert('Silakan pilih kelas tujuan');
      return;
    }

    if (targetType === 'SPECIFIC_STUDENT' && !targetValue) {
      alert('Silakan pilih siswa tujuan');
      return;
    }

    let targetName = undefined;
    if (targetType === 'CLASS') {
      targetName = targetValue; // Class Name is the value
    } else if (targetType === 'SPECIFIC_STUDENT') {
      const selectedStudent = scopedStudents.find(
        (student) => normalizeIdentity(student.id) === normalizeIdentity(targetValue)
          || normalizeIdentity(student.nisn) === normalizeIdentity(targetValue)
      );
      targetName = selectedStudent ? `${selectedStudent.name} (${selectedStudent.class})` : 'Siswa Tidak Dikenal';
    }

    await sendNotification(
      title,
      message,
      targetType,
      targetValue,
      targetName,
      user?.name || 'Admin',
      user?.schoolId
    );

    setTitle('');
    setMessage('');
    // Keep targetType same for convenience
    setTargetValue('');
    setStudentSearch('');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const getTargetLabel = (type: NotificationTargetType, name?: string) => {
    switch (type) {
      case 'TEACHERS': return 'Semua Wali Kelas & Guru';
      case 'ALL_CLASSES': return 'Semua Kelas';
      case 'CLASS': return `Kelas ${name}`;
      case 'SPECIFIC_STUDENT': return `Siswa: ${name}`;
      case 'STUDENTS': return 'Semua Siswa'; // Fallback
      default: return type;
    }
  };

  const getTargetIcon = (type: NotificationTargetType) => {
    switch (type) {
      case 'ALL_CLASSES': return <School className="w-4 h-4" />;
      case 'STUDENTS': return <GraduationCap className="w-4 h-4" />;
      case 'SPECIFIC_STUDENT': return <User className="w-4 h-4" />;
      case 'TEACHERS': return <Users className="w-4 h-4" />;
      case 'CLASS': return <Users className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Bell className="w-6 h-6 text-indigo-600" />
            Broadcast Notifikasi
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Kirim pengumuman penting ke wali kelas, siswa, atau grup kelas.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Section */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-effect-dark-card rounded-xl shadow-sm border border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <Send className="w-5 h-5 text-slate-400" />
              Buat Pengumuman Baru
            </h2>

            {showSuccess && (
              <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4" />
                Notifikasi berhasil dikirim!
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-slate-100">
              <div>
                <label className="block text-sm font-medium text-slate-100 mb-1">Judul Pengumuman</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all glass-effect-dark-card text-black placeholder:text-slate-400"
                  placeholder="Contoh: Pengumuman Upacara Senin"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-100 mb-1">Target Penerima</label>
                <select
                  value={targetType}
                  onChange={(e) => {
                    setTargetType(e.target.value as NotificationTargetType);
                    setTargetValue('');
                    setStudentSearch('');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all glass-effect-dark-card text-black"
                >
                  <option value="TEACHERS" className="text-black glass-effect-dark-card">Wali Kelas</option>
                  <option value="SPECIFIC_STUDENT" className="text-black glass-effect-dark-card">Siswa</option>
                  <option value="CLASS" className="text-black glass-effect-dark-card">Kelas Tertentu</option>
                  <option value="ALL_CLASSES" className="text-black glass-effect-dark-card">Semua Kelas</option>
                </select>
              </div>

              {/* Class Selector */}
              {targetType === 'CLASS' && (
                <div>
                  <label className="block text-sm font-medium text-slate-100 mb-1">Pilih Kelas</label>
                  <select
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all glass-effect-dark-card text-black"
                    required
                  >
                    <option value="" className="text-slate-400">-- Pilih Kelas --</option>
                    {classes.map(cls => (
                      <option key={cls.id} value={cls.name} className="text-black glass-effect-dark-card">{cls.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Student Selector */}
              {targetType === 'SPECIFIC_STUDENT' && (
                <div>
                  <label className="block text-sm font-medium text-slate-100 mb-1">Cari Siswa</label>
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all mb-2 glass-effect-dark-card text-black placeholder:text-slate-400"
                    placeholder="Ketik nama, NISN, atau kelas..."
                  />
                  
                  {studentSearch && (
                    <div className="border rounded-lg max-h-40 overflow-y-auto glass-effect-dark-card">
                      {filteredStudents.length > 0 ? (
                        filteredStudents.map(s => (
                          <div 
                            key={s.id}
                            onClick={() => {
                              setTargetValue(s.id);
                              setStudentSearch(`${s.name} (${s.class})`);
                            }}
                            className={`p-2 text-sm cursor-pointer hover:bg-indigo-50 flex justify-between items-center ${targetValue === s.id ? 'bg-indigo-100 text-indigo-900' : 'text-slate-100'}`}
                          >
                            <span className="text-black">{s.name}</span>
                            <span className="text-xs text-slate-400">{s.class}</span>
                          </div>
                        ))
                      ) : (
                        <div className="p-2 text-sm text-slate-400 text-center">Tidak ada siswa ditemukan</div>
                      )}
                    </div>
                  )}
                  {targetValue && !studentSearch && (
                     <div className="text-sm text-green-600 mt-1 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> 
                        Siswa terpilih
                     </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-100 mb-1">Isi Pesan</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none glass-effect-dark-card text-black placeholder:text-slate-400"
                  placeholder="Tulis pesan lengkap di sini..."
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>Memproses...</>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Kirim Broadcast
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* History Section */}
        <div className="lg:col-span-2">
          <div className="glass-effect-dark-card rounded-xl shadow-sm border border-slate-700 flex flex-col h-full">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <History className="w-5 h-5 text-slate-400" />
                Riwayat Broadcast
              </h2>
              {(notifications?.length || 0) > 0 && (
                <button 
                  onClick={() => {
                    if (confirm('Hapus semua riwayat notifikasi?')) {
                      void clearHistory();
                    }
                  }}
                  className="text-sm text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-md transition-colors"
                >
                  Hapus Semua
                </button>
              )}
            </div>

            <div className="flex-1 p-6 overflow-y-auto max-h-[600px]">
              {(notifications?.length || 0) === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Bell className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p>Belum ada notifikasi yang dikirim.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {notifications?.map((notif) => (
                    <div key={notif.id} className="group flex gap-4 p-4 rounded-lg border border-slate-700 hover:border-slate-700 hover:shadow-sm transition-all bg-slate-900/30/50 hover:glass-effect-dark-card">
                      <div className="flex-shrink-0 mt-1">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                          {getTargetIcon(notif.targetType)}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold text-slate-100 truncate pr-4">{notif.title}</h3>
                          <span className="text-xs text-gray-400 whitespace-nowrap">
                            {new Date(notif.sentAt).toLocaleString('id-ID', { 
                              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
                            })}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-indigo-600 mt-0.5 mb-1 flex items-center gap-1">
                          Kepada: {getTargetLabel(notif.targetType, notif.targetName || notif.targetValue)}
                          <span className="text-gray-300 mx-1">•</span>
                          Dari: {notif.senderName}
                        </p>
                        <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">{notif.message}</p>
                      </div>
                      <button
                        onClick={() => {
                          void deleteNotification(notif.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-600 transition-all self-start"
                        title="Hapus notifikasi ini"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import RecapTable from "@/components/attendance/RecapTable";
import DailyMonitoring from "@/components/attendance/DailyMonitoring";
import { useAuthStore } from "@/store/useAuthStore";
import { useTeacherStore } from "@/store/useTeacherStore";
import { useAttendanceStore } from "@/store/useAttendanceStore";
import { useClassStore } from "@/store/useClassStore";

export default function AttendanceReportPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { teachers, subscribeToTeachers } = useTeacherStore();
  const { logs, initAttendanceSync } = useAttendanceStore();
  const { classes } = useClassStore();
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly'>('daily');
  const [adminSelectedClassId, setAdminSelectedClassId] = useState<string>("");
  const normalizeIdentity = (value: unknown) => String(value || "").trim();

  useEffect(() => {
    const unsub = subscribeToTeachers();
    const unsubLogs = initAttendanceSync();
    return () => {
        unsub();
        unsubLogs();
    };
  }, [subscribeToTeachers, initAttendanceSync]);

  // Force monthly tab for student
  useEffect(() => {
    if (user?.role === 'student') {
        setActiveTab('monthly');
    }
  }, [user]);

  // Filter logs for student
  const studentLogs = useMemo(() => {
      if (user?.role !== 'student') return [];
      return logs
          .filter((log) =>
            [normalizeIdentity(user.id), normalizeIdentity(user.nisn)]
              .filter(Boolean)
              .includes(normalizeIdentity(log.studentId))
          )
          .sort((a, b) => b.date - a.date);
  }, [logs, user]);

  // Determine Class Name (For Teacher View Only)
  const { className, teacherName } = useMemo(() => {
    if (user?.role === 'teacher') {
      const me = teachers.find(t => t.nuptk === user.id);
      return { 
        className: me?.homeroomClass || "",
        teacherName: me?.name || "Guru"
      };
    }
    return { className: "-", teacherName: "-" };
  }, [user, teachers]);

  if (user?.role === "admin" || user?.role === "super_admin") {
    return (
      <div className="min-h-screen p-6 space-y-6">
        <h1 className="text-2xl font-bold text-slate-100">Rekap Kehadiran</h1>
        <div className="glass-effect-dark-card rounded-lg p-6">
           <RecapTable />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-700 px-6 pt-6 pb-4 shadow-xl">
        <div className="flex items-center text-white mb-4">
          <button onClick={() => router.back()} className="mr-4">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold">
                {user?.role === 'student' ? 'Riwayat Absensi Saya' : 'Rekapitulasi Kehadiran'}
            </h1>
          </div>
        </div>

        {/* Tabs - Only for Teacher */}
        {user?.role === 'teacher' && (
            <div className="flex space-x-6 text-sm font-medium text-blue-100 mt-6">
                <button 
                    onClick={() => setActiveTab('daily')}
                    className={`pb-2 px-1 border-b-2 transition-colors ${
                        activeTab === 'daily' 
                        ? 'border-white text-white font-bold' 
                        : 'border-transparent hover:text-white'
                    }`}
                >
                    Monitoring Harian
                </button>
                <button 
                    onClick={() => setActiveTab('monthly')}
                    className={`pb-2 px-1 border-b-2 transition-colors ${
                        activeTab === 'monthly' 
                        ? 'border-white text-white font-bold' 
                        : 'border-transparent hover:text-white'
                    }`}
                >
                    Rekap Bulanan
                </button>
            </div>
        )}
      </div>

      <div className="px-6 mt-6">
        {user?.role === 'student' ? (
            <div className="max-w-md mx-auto space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {studentLogs.length > 0 ? (
                    studentLogs.map(log => (
                        <div key={log.id} className="glass-effect-dark-card rounded-xl p-4 flex justify-between items-center border border-slate-700">
                            <div>
                                <p className="font-bold text-slate-100 text-sm">
                                    {new Date(log.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">{log.checkInTime || '-'}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                                    log.status === 'LATE' ? 'bg-orange-900/30 text-orange-400 border border-orange-600' :
                                    log.status === 'PRESENT' ? 'bg-green-900/30 text-green-400 border border-green-600' :
                                    log.status === 'ABSENT' ? 'bg-red-900/30 text-red-400 border border-red-600' :
                                    'bg-blue-900/30 text-blue-400 border border-blue-600'
                                }`}>
                                    {log.status === 'LATE' ? 'TERLAMBAT' : 
                                     log.status === 'PRESENT' ? 'HADIR' :
                                     log.status === 'ABSENT' ? 'ALPHA' :
                                     log.status === 'SICK' ? 'SAKIT' : 'IZIN'}
                                </span>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-10 glass-effect-dark-card rounded-xl border border-slate-700">
                        <p className="text-slate-400 text-sm">Belum ada riwayat absensi.</p>
                    </div>
                )}
            </div>
        ) : activeTab === 'monthly' ? (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="glass-effect-dark-card rounded-lg p-4">
                    <RecapTable /> 
                </div>
            </div>
        ) : (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <DailyMonitoring 
                    className={className} 
                    currentTeacherName={teacherName} 
                />
            </div>
        )}
      </div>
    </div>
  );
}

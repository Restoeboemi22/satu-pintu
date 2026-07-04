"use client";

import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Calendar as CalendarIcon, Save } from "lucide-react";
import { useStudentStore } from "@/store/useStudentStore";
import { useAttendanceStore, AttendanceLog } from "@/store/useAttendanceStore";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "sonner";
import { callAdminApi, hasEduLockAdminSession } from "@/lib/callAdminApi";
import { callPortalApi } from "@/lib/callPortalApi";

interface DailyMonitoringProps {
  className: string;
  currentTeacherName: string;
}

export default function DailyMonitoring({ className, currentTeacherName }: DailyMonitoringProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { students, syncStudents } = useStudentStore();
  const { user } = useAuthStore();
  const { logs, initAttendanceSync } = useAttendanceStore();
  const [isSaving, setIsSaving] = useState(false);

  const normalize = (value: unknown) => String(value || "").trim().toLowerCase();

  // Filter students by class
  const classStudents = useMemo(() => {
    const sid = normalize(user?.schoolId);
    return students
      .filter((s) => !sid || normalize((s as any)?.schoolId) === sid)
      .filter(s => (s.class || "").toUpperCase() === className.toUpperCase())
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [students, className, user?.schoolId]);

  // Sync Data
  useEffect(() => {
    const unsubStudents = syncStudents();
    const unsubLogs = initAttendanceSync();
    return () => {
      unsubStudents();
      unsubLogs();
    };
  }, [syncStudents, initAttendanceSync]);

  // Get logs for selected date
  const dailyLogs = useMemo(() => {
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    return logs.filter(log => {
      const logDate = new Date(log.date);
      return logDate >= startOfDay && logDate <= endOfDay;
    });
  }, [logs, selectedDate]);

  // Statistics
  const stats = useMemo(() => {
    let h = 0, s = 0, i = 0, a = 0;
    
    classStudents.forEach(student => {
      const log = dailyLogs.find(l => l.studentId === student.id || l.studentId === student.nisn);
      if (log) {
        if (log.status === 'PRESENT' || log.status === 'LATE') h++;
        else if (log.status === 'SICK') s++;
        else if (log.status === 'PERMIT') i++;
        else if (log.status === 'ABSENT') a++;
      }
    });

    return { h, s, i, a };
  }, [classStudents, dailyLogs]);

  // Helper to update attendance
  const updateAttendance = async (studentId: string, status: 'PRESENT' | 'SICK' | 'PERMIT' | 'ABSENT', studentName: string) => {
    try {
      // Check if log exists for this student on this date
      const existingLog = dailyLogs.find(l => l.studentId === studentId);
      
      const logData = {
        studentId,
        studentName,
        date: selectedDate.getTime(), // Use selected date time
        status,
        checkInTime: status === 'PRESENT' ? format(new Date(), 'HH:mm') : null,
        checkInMethod: 'MANUAL_TEACHER',
        notes: `Input by ${currentTeacherName}`,
        updatedAt: Date.now()
      };

      if (existingLog) {
        if (hasEduLockAdminSession()) {
          await callAdminApi("/api/admin/attendance-logs", "POST", {
            action: "upsert-manual-log",
            schoolId: user?.schoolId || undefined,
            log: {
              id: String(existingLog.id),
              ...logData,
              recordedBy: currentTeacherName,
            },
          });
        } else {
          await callPortalApi("/api/portal/attendance", "POST", {
            action: "upsert-manual-log",
            log: {
              id: String(existingLog.id),
              ...logData,
              recordedBy: currentTeacherName,
            },
          });
        }
      } else {
        if (hasEduLockAdminSession()) {
          await callAdminApi("/api/admin/attendance-logs", "POST", {
            action: "upsert-manual-log",
            schoolId: user?.schoolId || undefined,
            log: {
              ...logData,
              recordedBy: currentTeacherName,
            },
          });
        } else {
          await callPortalApi("/api/portal/attendance", "POST", {
            action: "upsert-manual-log",
            log: {
              ...logData,
              recordedBy: currentTeacherName,
            },
          });
        }
      }
    } catch (error) {
      console.error("Error updating attendance:", error);
      toast.error("Gagal mengupdate presensi");
    }
  };

  const handleMarkAllPresent = async () => {
    setIsSaving(true);
    try {
      const updates: Promise<void>[] = [];
      
      classStudents.forEach(student => {
        const existingLog = dailyLogs.find(l => l.studentId === student.id || l.studentId === student.nisn);
        // Only mark present if no status or currently ABSENT (don't overwrite SICK/PERMIT)
        if (!existingLog || existingLog.status === 'ABSENT') {
          updates.push(updateAttendance(student.id || student.nisn, 'PRESENT', student.name));
        }
      });

      await Promise.all(updates);
      toast.success("Semua siswa ditandai hadir");
    } catch (error) {
      toast.error("Gagal memproses data");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cards Info */}
      <div className="space-y-4">
        {/* Kelas Wali */}
        <div className="bg-blue-900/30 p-4 rounded-xl border border-blue-700/30">
          <p className="text-xs text-blue-400 font-semibold mb-1">Kelas Wali</p>
          <p className="text-xl font-bold text-blue-300">{className}</p>
        </div>

        {/* Tanggal Absensi */}
        <div className="bg-blue-900/30 p-4 rounded-xl border border-blue-700/30 flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-400 font-semibold mb-1">Tanggal Absensi</p>
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-blue-300" />
                <p className="text-lg font-bold text-blue-200 capitalize">
                  {format(selectedDate, "EEEE, d MMMM yyyy", { locale: id })}
                </p>
              </div>
            </div>
            {/* Date Picker Trigger (Simple HTML date input for now, could be styled better) */}
            <input 
                type="date" 
                className="p-2 border border-slate-600 rounded-md text-sm bg-slate-900/50 text-slate-100 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={format(selectedDate, "yyyy-MM-dd")}
                onChange={(e) => e.target.value && setSelectedDate(new Date(e.target.value))}
            />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-green-900/30 p-3 rounded-lg border border-green-700/30 text-center">
          <p className="text-2xl font-bold text-green-400">{stats.h}</p>
          <p className="text-xs font-semibold text-green-300">Hadir</p>
        </div>
        <div className="bg-blue-900/30 p-3 rounded-lg border border-blue-700/30 text-center">
          <p className="text-2xl font-bold text-blue-400">{stats.s}</p>
          <p className="text-xs font-semibold text-blue-300">Sakit</p>
        </div>
        <div className="bg-orange-900/30 p-3 rounded-lg border border-orange-700/30 text-center">
          <p className="text-2xl font-bold text-orange-400">{stats.i}</p>
          <p className="text-xs font-semibold text-orange-300">Izin</p>
        </div>
        <div className="bg-red-900/30 p-3 rounded-lg border border-red-700/30 text-center">
          <p className="text-2xl font-bold text-red-400">{stats.a}</p>
          <p className="text-xs font-semibold text-red-300">Alpa</p>
        </div>
      </div>

      {/* Mark All Present Button */}
      <button 
        onClick={handleMarkAllPresent}
        disabled={isSaving}
        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
      >
        {isSaving ? "Menyimpan..." : "Tandai Semua Hadir"}
      </button>

      {/* Student List Table */}
      <div className="glass-effect-dark-card rounded-lg overflow-hidden shadow-sm">
        <div className="grid grid-cols-12 bg-slate-800/50 border-b border-slate-700 p-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
          <div className="col-span-1 text-center">No</div>
          <div className="col-span-6">Nama Siswa</div>
          <div className="col-span-5 text-center">Presensi</div>
        </div>
        
        <div className="divide-y divide-slate-700">
          {classStudents.map((student, index) => {
            const log = dailyLogs.find(l => l.studentId === student.id || l.studentId === student.nisn);
            const currentStatus = log?.status; // PRESENT, LATE, SICK, PERMIT, ABSENT

            // Helper to check radio
            const isChecked = (statusVal: string) => {
              if (statusVal === 'H') return currentStatus === 'PRESENT' || currentStatus === 'LATE';
              if (statusVal === 'S') return currentStatus === 'SICK';
              if (statusVal === 'I') return currentStatus === 'PERMIT';
              if (statusVal === 'A') return currentStatus === 'ABSENT';
              return false;
            };

            return (
              <div key={student.id} className="grid grid-cols-12 p-3 items-center hover:bg-slate-800/30 transition-colors">
                <div className="col-span-1 text-center text-sm font-semibold text-slate-400">
                  {index + 1}
                </div>
                <div className="col-span-6 pr-2">
                  <p className="text-sm font-semibold text-slate-100 truncate">{student.name}</p>
                </div>
                <div className="col-span-5 flex justify-between px-2">
                  {/* Radio Group */}
                  {['H', 'S', 'I', 'A'].map((opt) => (
                    <label key={opt} className="flex flex-col items-center cursor-pointer group">
                      <span className={`text-[10px] font-bold mb-1 ${
                        opt === 'H' ? 'text-green-400' :
                        opt === 'S' ? 'text-blue-400' :
                        opt === 'I' ? 'text-orange-400' : 'text-red-400'
                      }`}>{opt}</span>
                      <input 
                        type="radio" 
                        name={`status-${student.id}`}
                        checked={isChecked(opt)}
                        onChange={() => {
                          const newStatus = 
                            opt === 'H' ? 'PRESENT' :
                            opt === 'S' ? 'SICK' :
                            opt === 'I' ? 'PERMIT' : 'ABSENT';
                          updateAttendance(student.id || student.nisn, newStatus, student.name);
                        }}
                        className="w-4 h-4 text-blue-600 border-slate-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
          
          {classStudents.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm">
              Belum ada data siswa di kelas ini.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

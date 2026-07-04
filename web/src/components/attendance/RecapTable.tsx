"use client";

import { useState, useMemo, useEffect } from "react";
import { Printer, Calendar, List } from "lucide-react";
import { useClassStore } from "@/store/useClassStore";
import { useStudentStore } from "@/store/useStudentStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useAttendanceStore } from "@/store/useAttendanceStore";
import { useTeacherStore } from "@/store/useTeacherStore";
import { Student } from "@/types/student";

// Tipe Data untuk Tampilan Tabel Harian
interface AttendanceRow {
  id: string;
  date: string; // YYYY-MM-DD
  studentName: string;
  nisn: string;
  checkIn: string | null; // HH:mm
  checkOut: string | null; // HH:mm
  status: "H" | "S" | "I" | "A"; // Hadir, Sakit, Izin, Alpha
  className: string;
}

// Tipe Data untuk Rekap Bulanan
interface StudentSummary {
  student: Student;
  h: number; // Hadir + Late
  s: number; // Sakit
  i: number; // Izin
  a: number; // Alpha
  percentage: string;
}

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const formatTime = (time: string | number | null) => {
  if (!time) return "-";
  const numTime = Number(time);
  if (!isNaN(numTime) && numTime > 1000000000000) {
    return new Date(numTime).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).replace(".", ":");
  }
  return String(time);
};

export default function RecapTable() {
  const dropdownClassName =
    "rounded-md border border-slate-500/70 bg-slate-950/90 py-2 pl-3 pr-8 text-sm font-medium text-slate-50 shadow-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-500/60";
  const dropdownStyle = { backgroundColor: "#020617", color: "#f8fafc", colorScheme: "dark" as const };
  const dropdownOptionStyle = { backgroundColor: "#020617", color: "#f8fafc" };
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [viewMode, setViewMode] = useState<'summary' | 'daily'>('summary');
  
  const { classes } = useClassStore();
  const { students } = useStudentStore();
  const { user } = useAuthStore();
  const { logs, getLogsByClassAndDate } = useAttendanceStore();
  const { teachers, subscribeToTeachers } = useTeacherStore();
  const [selectedClassId, setSelectedClassId] = useState<string>("");

  useEffect(() => {
    const unsub = subscribeToTeachers();
    return () => unsub();
  }, [subscribeToTeachers]);

  // Helper to format class name (e.g. VII-A -> 7A)
  const formatClassName = (name: string) => {
    return name.replace("VIII", "8").replace("VII", "7").replace("IX", "9").replace("-", "");
  };

  // Sort classes: 7 first, then 8, then 9
  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) => {
      const nameA = formatClassName(a.name);
      const nameB = formatClassName(b.name);
      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [classes]);

  // Determine if user is restricted to a specific class (Simulation for Teacher/Wali Kelas)
  const restrictedClassId = useMemo(() => {
    if (user?.role === 'teacher') {
      const me = teachers.find((t) => t.nuptk === user.id);
      if (me?.homeroomClass) {
        const myClass = classes.find((c) => c.name === me.homeroomClass);
        return myClass?.id || null;
      }
      return null;
    }
    if (user?.role === 'student') {
      // Find the student's class
      const me = students.find(s => s.nisn === user.id);
      if (me && me.class) {
         const myClass = classes.find(c => c.name === me.class);
         return myClass?.id;
      }
    }
    return null;
  }, [user, students, classes, teachers]);

  // Effect to auto-select restricted class
  useEffect(() => {
    if (restrictedClassId) {
      setSelectedClassId(restrictedClassId);
    }
  }, [restrictedClassId]);

  // Filter students based on selected class
  const filteredStudents = useMemo(() => {
    if (!selectedClassId) return [];
    const selectedClass = classes.find(c => c.id === selectedClassId);
    if (!selectedClass) return [];
    
    // FIX: Handle potential undefined s.class
    const sid = String(user?.schoolId || "").trim().toLowerCase();
    let list = students
      .filter((s) => !sid || String((s as any)?.schoolId || "").trim().toLowerCase() === sid)
      .filter(s => (s.class || "").trim().toUpperCase() === selectedClass.name.trim().toUpperCase());

    // Filter for Student Role: Show only themselves
    if (user?.role === 'student') {
      list = list.filter(s => s.nisn === user.id);
    }

    return list;
  }, [students, selectedClassId, classes, user]);

  // Data for Monthly Recap (Summary)
  const studentSummaries = useMemo(() => {
    if (filteredStudents.length === 0) return [];

    const monthLogs = getLogsByClassAndDate(selectedClassId, selectedMonth, selectedYear);
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const today = new Date();

    return filteredStudents.map(student => {
      let h = 0, s = 0, i = 0, a = 0;

      // Iterate days to calculate stats
      for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(selectedYear, selectedMonth - 1, d);
        
        // Skip Sundays
        if (dateObj.getDay() === 0) continue; 
        
        // Skip future dates
        if (dateObj > today) continue;

        const log = monthLogs.find(l => {
           const lDate = new Date(l.date);
           return l.studentId === student.id && 
                  lDate.getDate() === d;
        });

        if (log) {
          if (log.status === 'PRESENT' || log.status === 'LATE') h++;
          else if (log.status === 'SICK') s++;
          else if (log.status === 'PERMIT') i++;
          else if (log.status === 'ABSENT') a++;
        } else {
          // No log for a past valid day = Alpha
          a++;
        }
      }
      
      const totalAttendance = h + s + i + a;
      const presentPercentage = totalAttendance > 0 ? ((h / totalAttendance) * 100).toFixed(0) : "0";

      return {
          student,
          h, s, i, a,
          percentage: presentPercentage
      };
    }).sort((a, b) => a.student.name.localeCompare(b.student.name));
  }, [filteredStudents, selectedMonth, selectedYear, logs, getLogsByClassAndDate, selectedClassId]);

  // Data for Daily History (Detailed Logs)
  const attendanceLogs = useMemo(() => {
    if (filteredStudents.length === 0) return [];

    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const rows: AttendanceRow[] = [];
    const monthLogs = getLogsByClassAndDate(selectedClassId, selectedMonth, selectedYear);
    const today = new Date();

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(selectedYear, selectedMonth - 1, d);
      const dayOfWeek = dateObj.getDay();
      
      if (dayOfWeek === 0) continue; 
      if (dateObj > today) continue; // Don't show future rows in daily list either

      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      filteredStudents.forEach((student) => {
        const log = monthLogs.find(l => {
           const lDate = new Date(l.date);
           return l.studentId === student.id && 
                  lDate.getDate() === d;
        });

        let status: "H" | "S" | "I" | "A" = "A"; 
        let checkIn: string | null = null;
        let checkOut: string | null = null;

        if (log) {
          switch(log.status) {
            case 'PRESENT': status = "H"; break;
            case 'LATE': status = "H"; break; 
            case 'SICK': status = "S"; break;
            case 'PERMIT': status = "I"; break;
            case 'ABSENT': status = "A"; break;
          }
          checkIn = log.checkInTime || null;
        }

        rows.push({
          id: `${dateStr}-${student.nisn}`,
          date: dateStr,
          studentName: student.name,
          nisn: student.nisn,
          checkIn,
          checkOut,
          status,
          className: student.class || "-",
        });
      });
    }
    
    return rows.sort((a, b) => b.date.localeCompare(a.date) || a.studentName.localeCompare(b.studentName));
  }, [filteredStudents, selectedMonth, selectedYear, logs, getLogsByClassAndDate, selectedClassId]);

  const selectedClassName = classes.find(c => c.id === selectedClassId)?.name || "-";

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="rounded-lg glass-effect-dark-card p-6 shadow">
      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
            background: white;
            z-index: 9999;
          }
          .no-print {
            display: none !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
            font-size: 12px;
          }
          th, td {
            border: 1px solid black !important;
            padding: 4px 8px !important;
            color: black !important;
          }
          ::-webkit-scrollbar {
            display: none;
          }
        }
      `}</style>

      {/* Header & Filters */}
      <div className="mb-6 flex flex-col gap-4 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-medium leading-6 text-slate-100">Data Rekapitulasi</h3>
            <p className="mt-1 text-sm text-slate-400">
              Laporan kehadiran siswa per kelas
            </p>
          </div>
          
          <button
            onClick={handlePrint}
            disabled={!selectedClassId || filteredStudents.length === 0}
            className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 text-sm font-medium text-white hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="h-4 w-4" />
            Cetak Laporan
          </button>
        </div>
        
        {/* View Mode Tabs */}
        <div className="flex space-x-1 rounded-lg bg-slate-800/30 p-1 w-fit">
          <button
            onClick={() => setViewMode('summary')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors
              ${viewMode === 'summary' 
                ? 'bg-slate-800/80 text-blue-300 shadow' 
                : 'text-slate-400 hover:text-slate-300'
              }`}
          >
            <List className="h-4 w-4" />
            Rekap Bulanan (Siswa)
          </button>
          <button
            onClick={() => setViewMode('daily')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors
              ${viewMode === 'daily' 
                ? 'bg-slate-800/80 text-blue-300 shadow' 
                : 'text-slate-400 hover:text-slate-300'
              }`}
          >
            <Calendar className="h-4 w-4" />
            Riwayat Harian
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-800/30 p-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-400">Kelas</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              disabled={!!restrictedClassId}
              className={`${dropdownClassName} min-w-[150px]
                ${!!restrictedClassId ? 'opacity-50 cursor-not-allowed text-slate-400' : ''}
              `}
              style={dropdownStyle}
            >
              <option value="" style={dropdownOptionStyle}>-- Pilih Kelas --</option>
              {sortedClasses.length > 0 ? (
                sortedClasses.map((cls) => (
                  <option key={cls.id} value={cls.id} style={dropdownOptionStyle}>
                    {cls.name}
                  </option>
                ))
              ) : (
                <option disabled style={dropdownOptionStyle}>Data kelas tidak ditemukan</option>
              )}
            </select>
            {!!restrictedClassId && (
               <span className="text-[10px] text-blue-400 italic">Mode Wali Kelas (Terkunci)</span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-400">Bulan</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className={dropdownClassName}
              style={dropdownStyle}
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1} style={dropdownOptionStyle}>{m}</option>
              ))}
            </select>
          </div>
          
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-400">Tahun</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className={dropdownClassName}
              style={dropdownStyle}
            >
              {Array.from({ length: (new Date().getFullYear() + 5) - 2024 + 1 }, (_, i) => 2024 + i).map((y) => (
                <option key={y} value={y} style={dropdownOptionStyle}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Printable Area */}
      <div id="print-area">
        {/* Print Header */}
        <div className="hidden print:block mb-6 text-center">
          <h1 className="text-2xl font-bold uppercase text-black">SMP NEGERI 3 PACET</h1>
          <h2 className="text-xl font-semibold text-black">
            {viewMode === 'summary' ? 'Laporan Rekapitulasi Kehadiran' : 'Laporan Riwayat Kehadiran Harian'}
          </h2>
          <div className="flex justify-center gap-8 mt-2 text-black font-medium">
             <p>Kelas: {selectedClassName}</p>
             <p>Periode: {MONTHS[selectedMonth - 1]} {selectedYear}</p>
          </div>
          <div className="mt-4 border-b-2 border-black"></div>
        </div>

        {viewMode === 'summary' ? (
          // TABLE: REKAP BULANAN (DAFTAR SISWA)
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700 border border-slate-700">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 w-10">No</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700">NISN</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700">Nama Siswa</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 w-10">L/P</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 bg-green-900/20">H</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 bg-yellow-900/20">S</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 bg-blue-900/20">I</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700 bg-red-900/20">A</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700">%</th>
                </tr>
              </thead>
              <tbody className="bg-slate-900/20 divide-y divide-slate-700">
                {studentSummaries.length > 0 ? (
                  studentSummaries.map((item, index) => (
                    <tr key={item.student.id} className="hover:bg-slate-800/30">
                      <td className="px-6 py-4 text-center text-sm text-slate-400">{index + 1}</td>
                      <td className="px-6 py-4 text-sm text-slate-400">{item.student.nisn}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-100">{item.student.name}</td>
                      <td className="px-6 py-4 text-center text-sm text-slate-400">{item.student.gender}</td>
                      <td className="px-6 py-4 text-center text-sm font-bold text-green-400 bg-green-900/10">{item.h}</td>
                      <td className="px-6 py-4 text-center text-sm font-bold text-yellow-400 bg-yellow-900/10">{item.s}</td>
                      <td className="px-6 py-4 text-center text-sm font-bold text-blue-400 bg-blue-900/10">{item.i}</td>
                      <td className="px-6 py-4 text-center text-sm font-bold text-red-400 bg-red-900/10">{item.a}</td>
                      <td className="px-6 py-4 text-center text-sm font-bold text-slate-200">{item.percentage}%</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-6 py-10 text-center text-sm text-slate-500">
                      {!selectedClassId 
                        ? "Silakan pilih kelas terlebih dahulu." 
                        : "Tidak ada data siswa dalam kelas ini."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          // TABLE: RIWAYAT HARIAN (LOGS)
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700 border border-slate-700">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700">Tanggal</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700">Nama Siswa</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700">NISN</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700">Kelas</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700">Datang</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700">Pulang</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700">Ket</th>
                </tr>
              </thead>
              <tbody className="bg-slate-900/20 divide-y divide-slate-700">
                {attendanceLogs.length > 0 ? (
                  attendanceLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-100">
                        {new Date(log.date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-100">{log.studentName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{log.nisn}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-slate-100">{log.className}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-slate-100">{formatTime(log.checkIn)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-slate-100">{formatTime(log.checkOut)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold
                          ${log.status === 'H' ? 'bg-green-900/30 text-green-400 border border-green-700/30' : ''}
                          ${log.status === 'S' ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-700/30' : ''}
                          ${log.status === 'I' ? 'bg-blue-900/30 text-blue-400 border border-blue-700/30' : ''}
                          ${log.status === 'A' ? 'bg-red-900/30 text-red-400 border border-red-700/30' : ''}
                        `}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-500">
                      {!selectedClassId 
                        ? "Silakan pilih kelas terlebih dahulu." 
                        : "Tidak ada data riwayat absensi."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Print Footer */}
        <div className="hidden print:block mt-12">
          <div className="flex justify-end">
            <div className="text-center w-64">
              <p className="text-black mb-16">Pacet, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p className="text-black font-bold underline">Kepala Sekolah</p>
              <p className="text-black">NIP. .......................</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useStudentStore } from "@/store/useStudentStore";
import { useTeacherStore } from "@/store/useTeacherStore";
import { useAttendanceStore } from "@/store/useAttendanceStore";
import { useDisciplineStore } from "@/store/useDisciplineStore";
import { useBullyingStore } from "@/store/useBullyingStore";
import StatsCard from "@/components/dashboard/StatsCard";
import { Users, UserCheck, Clock, AlertTriangle, Trophy, AlertOctagon, BookOpen, MapPin, Info, Smile, Star, Megaphone, Bell, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  
  const { students } = useStudentStore();
  const { teachers } = useTeacherStore();
  const { logs } = useAttendanceStore();
  const { records, rules } = useDisciplineStore();
  const { reports } = useBullyingStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !user) return;
    if (user.role === "super_admin") {
      router.replace("/dashboard/super");
      return;
    }
    if (user.role === "admin") {
      router.replace("/dashboard/students");
      return;
    }
    if (user.role === "teacher") {
      router.replace("/dashboard/attendance-report");
    }
  }, [mounted, router, user]);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-400">Please login first</div>
      </div>
    );
  }

  if (user.role !== "student") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-400">Mengarahkan ke halaman GAS...</div>
      </div>
    );
  }

  // Calculate Stats
  const studentCount = students.length;
  const teacherCount = teachers.length;

  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).getTime();
  const studentIdentitySet = new Set<string>();
  students.forEach((student) => {
    if (student.id) studentIdentitySet.add(String(student.id));
    if ((student as any).nisn) studentIdentitySet.add(String((student as any).nisn));
  });
  const findStudentByIdentity = (value: string | undefined | null) => {
    const identity = String(value || "").trim();
    return students.find((student) => student.id === identity || student.nisn === identity);
  };

  // STUDENT DASHBOARD
  if (user.role === 'student') {
    const me = students.find(s => s.nisn === user.id || s.id === user.id);
    
    return (
      <div className="max-w-5xl mx-auto space-y-8 pb-12">
        {/* Header Section */}
        <div className="glass-effect-dark-card rounded-3xl p-8 flex flex-col sm:flex-row justify-between items-start gap-6">
           <div>
              <p className="text-sm font-semibold text-slate-400 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </p>
              <h1 className="text-3xl font-black text-slate-100">
                Hai, {me?.name || user.name}! 👋
              </h1>
              <div className="flex items-center gap-3 mt-3">
                 <span className="text-sm font-semibold text-slate-300">Siswa SMPN 3 Pacet</span>
                 <span className="px-3 py-1 rounded-full text-xs font-bold premium-gradient-green text-white shadow-lg shadow-green-500/30">
                   AKTIF
                 </span>
              </div>
           </div>
           <div className="h-20 w-20 rounded-3xl premium-gradient flex items-center justify-center shadow-lg shadow-blue-500/30">
             <Smile className="w-10 h-10 text-white" />
           </div>
        </div>

        {/* Announcement Card */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-3xl p-8 shadow-xl shadow-blue-500/30 text-white">
           <h3 className="font-bold text-xl mb-2 flex items-center gap-2">
             <Bell className="w-6 h-6" />
             Pengumuman Terbaru
           </h3>
           <p className="text-blue-100 text-lg">Selamat datang di dashboard baru! Semoga harimu menyenangkan. 😊</p>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
           {/* Lentera Digital */}
           <Link href="/dashboard/library" className="group relative flex flex-col items-center justify-center p-8 glass-effect-dark-card rounded-3xl shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-300">
              <div className="w-20 h-20 rounded-2xl premium-gradient-green flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg shadow-green-500/30">
                 <BookOpen className="w-10 h-10 text-white" />
              </div>
              <span className="font-bold text-slate-200 text-center">Lentera Digital</span>
           </Link>

           {/* Absensi */}
           <Link href="/dashboard/attendance-report" className="group relative flex flex-col items-center justify-center p-8 glass-effect-dark-card rounded-3xl shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-300">
              <div className="w-20 h-20 rounded-2xl premium-gradient-blue flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/30">
                 <MapPin className="w-10 h-10 text-white" />
              </div>
              <span className="font-bold text-slate-200 text-center">Absensi</span>
           </Link>

           {/* Kedisiplinan */}
           <Link href="/dashboard/discipline" className="group relative flex flex-col items-center justify-center p-8 glass-effect-dark-card rounded-3xl shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-300">
              <div className="w-20 h-20 rounded-2xl premium-gradient-purple flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg shadow-purple-500/30">
                 <Info className="w-10 h-10 text-white" />
              </div>
              <span className="font-bold text-slate-200 text-center">Kedisiplinan</span>
           </Link>

           {/* Virtual Pet */}
           <Link href="/dashboard/virtual-pet" className="group relative flex flex-col items-center justify-center p-8 glass-effect-dark-card rounded-3xl shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-300">
              <div className="w-20 h-20 rounded-2xl premium-gradient-orange flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg shadow-orange-500/30">
                 <Smile className="w-10 h-10 text-white" />
              </div>
              <span className="font-bold text-slate-200 text-center">Virtual Pet</span>
           </Link>

           {/* 7 KAIH */}
           <Link href="/dashboard/seven-habits" className="group relative flex flex-col items-center justify-center p-8 glass-effect-dark-card rounded-3xl shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-300">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg shadow-cyan-500/30">
                 <Star className="w-10 h-10 text-white" />
              </div>
              <span className="font-bold text-slate-200 text-center">7 KAIH</span>
           </Link>

           {/* Layanan Aduan */}
           <Link href="/dashboard/halo-spentgapa" className="group relative flex flex-col items-center justify-center p-8 glass-effect-dark-card rounded-3xl shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-300">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg shadow-pink-500/30">
                 <AlertTriangle className="w-10 h-10 text-white" />
              </div>
              <span className="font-bold text-slate-200 text-center">Layanan Aduan</span>
           </Link>

           {/* Notifikasi */}
           <Link href="/dashboard/notifications" className="group relative flex flex-col items-center justify-center p-8 glass-effect-dark-card rounded-3xl shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-300">
              <div className="w-20 h-20 rounded-2xl premium-gradient-orange flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg shadow-yellow-500/30">
                 <Bell className="w-10 h-10 text-white" />
              </div>
              <span className="font-bold text-slate-200 text-center">Notifikasi</span>
           </Link>
        </div>

        {/* Footer */}
        <div className="text-center pt-8 pb-4">
           <h4 className="font-black text-2xl bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent tracking-wider">SMPN 3 PACET</h4>
           <p className="text-sm font-bold text-slate-500 mt-2">SEKOLAH MENTAL JUARA</p>
        </div>
      </div>
    );
  }

  // ADMIN / TEACHER DASHBOARD (Original Logic)
  const attendanceToday = logs.filter(log => log.date >= startOfDay && log.date <= endOfDay);
  const presentCount = attendanceToday.filter(log => log.status === 'PRESENT' || log.status === 'LATE').length;
  const lateCount = attendanceToday.filter(log => log.status === 'LATE').length;
  const scopedDisciplineRecords = records.filter((record) => studentIdentitySet.has(String(record.studentId)));
  const scopedBullyingReports = reports.filter((report) => {
    if (user.role === "super_admin") return true;
    return [report.reporterId, report.victimId, report.perpetratorId]
      .some((value) => value && studentIdentitySet.has(String(value)));
  });
  
  // Discipline Stats (This Month)
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
  const violationsThisMonth = scopedDisciplineRecords.filter(r => {
    const rule = rules.find(rule => rule.id === r.ruleId);
    return r.date >= startOfMonth && rule?.category === 'VIOLATION';
  }).length;

  const achievementsThisMonth = scopedDisciplineRecords.filter(r => {
    const rule = rules.find(rule => rule.id === r.ruleId);
    return r.date >= startOfMonth && rule?.category === 'ACHIEVEMENT';
  }).length;

  const pendingBullyingReports = scopedBullyingReports.filter(r => r.status === 'PENDING' || r.status === 'INVESTIGATING').length;

  // Recent Activities
  const recentLogs = [...logs].sort((a, b) => b.date - a.date).slice(0, 5);
  const recentDiscipline = [...scopedDisciplineRecords].sort((a, b) => b.date - a.date).slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-100">
            Dashboard Overview 🏫
          </h1>
          <p className="mt-2 text-lg text-slate-400">
            Selamat datang kembali, <span className="font-bold text-blue-400">{user.name}</span>. Berikut adalah ringkasan hari ini.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm font-bold text-slate-200 hover:text-white flex items-center gap-1 transition-colors bg-slate-900/40 px-4 py-2 rounded-full hover:bg-slate-900/60 border border-slate-700/50"
        >
          Kembali ke Dashboard Satu Pintu
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Siswa"
          value={studentCount}
          icon={Users}
          description="Siswa aktif terdaftar"
          color="blue"
        />
        <StatsCard
          title="Kehadiran Hari Ini"
          value={`${presentCount}/${studentCount}`}
          icon={Clock}
          description={`${lateCount} Terlambat`}
          color="green"
        />
        <StatsCard
          title="Pelanggaran Bulan Ini"
          value={violationsThisMonth}
          icon={AlertTriangle}
          description={`${achievementsThisMonth} Prestasi tercatat`}
          color="red"
        />
         <StatsCard
          title="Aduan Masuk"
          value={pendingBullyingReports}
          icon={AlertOctagon}
          description="Butuh penanganan"
          color="purple"
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        
        {/* Recent Attendance */}
        <div className="rounded-3xl bg-gradient-to-br from-slate-900/80 to-slate-900/60 backdrop-blur-2xl shadow-xl border border-slate-700/50 overflow-hidden hover:shadow-2xl transition-all duration-300">
          <div className="flex items-center justify-between border-b border-slate-700/50 p-6 bg-slate-900/40">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-3">
              <div className="p-2.5 bg-blue-900/50 rounded-xl border border-blue-700/50">
                <Clock className="w-5 h-5 text-blue-400" />
              </div>
              Kehadiran Terbaru
            </h2>
            <Link href="/dashboard/attendance" className="text-sm font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors bg-blue-900/30 px-4 py-2 rounded-full hover:bg-blue-900/50 border border-blue-700/30">
              Lihat Semua <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="p-6">
            {recentLogs.length > 0 ? (
              <div className="flow-root">
                <ul className="-my-4 divide-y divide-slate-700/30">
                  {recentLogs.map((log) => {
                    const student = findStudentByIdentity(log.studentId);
                    return (
                      <li key={log.id} className="py-4 hover:bg-slate-800/50 rounded-xl px-3 transition-colors">
                        <div className="flex items-center space-x-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-bold text-slate-100 truncate">
                              {student ? student.name : `Student #${log.studentId}`}
                            </p>
                            <p className="text-sm text-slate-400 truncate">
                              {student?.class} • {new Date(log.date).toLocaleTimeString()}
                            </p>
                          </div>
                          <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold shadow-sm
                            ${log.status === 'PRESENT' ? 'bg-green-900/50 text-green-300 border border-green-700/50' : 
                              log.status === 'LATE' ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50' :
                              'bg-slate-800/50 text-slate-300 border border-slate-700/50'}`}>
                            {log.status}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-8">Belum ada data kehadiran hari ini.</p>
            )}
          </div>
        </div>

        {/* Recent Discipline */}
        <div className="rounded-3xl bg-gradient-to-br from-slate-900/80 to-slate-900/60 backdrop-blur-2xl shadow-xl border border-slate-700/50 overflow-hidden hover:shadow-2xl transition-all duration-300">
          <div className="flex items-center justify-between border-b border-slate-700/50 p-6 bg-slate-900/40">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-3">
              <div className="p-2.5 bg-purple-900/50 rounded-xl border border-purple-700/50">
                <Trophy className="w-5 h-5 text-purple-400" />
              </div>
              Catatan Kedisiplinan Terbaru
            </h2>
            <Link href="/dashboard/discipline" className="text-sm font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors bg-purple-900/30 px-4 py-2 rounded-full hover:bg-purple-900/50 border border-purple-700/30">
              Lihat Semua <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="p-6">
             {recentDiscipline.length > 0 ? (
              <div className="flow-root">
                <ul className="-my-4 divide-y divide-slate-700/30">
                  {recentDiscipline.map((record) => {
                    const student = findStudentByIdentity(record.studentId);
                    const rule = rules.find(r => r.id === record.ruleId);
                    const isViolation = rule?.category === 'VIOLATION';
                    
                    return (
                      <li key={record.id} className="py-4 hover:bg-slate-800/50 rounded-xl px-3 transition-colors">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                             {isViolation ? (
                               <div className="h-10 w-10 rounded-2xl bg-red-900/50 flex items-center justify-center border border-red-700/50">
                                 <AlertTriangle className="h-5 w-5 text-red-400" />
                               </div>
                             ) : (
                               <div className="h-10 w-10 rounded-2xl bg-blue-900/50 flex items-center justify-center border border-blue-700/50">
                                 <Trophy className="h-5 w-5 text-blue-400" />
                               </div>
                             )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-bold text-slate-100 truncate">
                              {student ? student.name : `Student #${record.studentId}`}
                            </p>
                            <p className="text-sm text-slate-400 truncate">
                              {rule?.ruleName || 'Unknown Rule'}
                            </p>
                          </div>
                          <div className={`text-base font-black px-3 py-1.5 rounded-xl ${isViolation ? 'bg-red-900/50 text-red-300 border border-red-700/50' : 'bg-blue-900/50 text-blue-300 border border-blue-700/50'}`}>
                            {isViolation ? '-' : '+'}{record.points} Poin
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-8">Belum ada catatan kedisiplinan.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

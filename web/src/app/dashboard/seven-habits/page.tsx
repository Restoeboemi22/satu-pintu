"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useStudentStore } from "@/store/useStudentStore";
import { useClassStore } from "@/store/useClassStore";
import { useSevenHabitsStore, TeacherRubric, HabitLog } from "@/store/useSevenHabitsStore";
import { Check, X, Calendar, Printer, Download, GraduationCap, Save, Edit, Star } from "lucide-react";
import { exportToExcel } from "@/utils/export";
import { calculateHabitGrades } from "@/utils/grading7Habits";
import { toast } from "sonner";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const WEEKS = [
  { value: 1, label: "Minggu ke-1" },
  { value: 2, label: "Minggu ke-2" },
  { value: 3, label: "Minggu ke-3" },
  { value: 4, label: "Minggu ke-4" },
  { value: 5, label: "Minggu ke-5" },
];

const DAYS = [
  "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"
];

const YEARS = Array.from({ length: 2040 - 2024 + 1 }, (_, i) => 2024 + i);

const DEFAULT_TEACHER_RUBRIC: TeacherRubric = {
  honesty: 20,
  behavior: 20,
  initiative: 20,
  commitment: 20,
  total: 80,
};

const normalizeIdentity = (value: unknown) => String(value || "").trim();

const matchesStudentIdentity = (
  student: { id?: string | number; nisn?: string | number },
  logStudentId: unknown
) => {
  const normalizedLogStudentId = normalizeIdentity(logStudentId);
  if (!normalizedLogStudentId) return false;

  return [
    normalizeIdentity(student.id),
    normalizeIdentity(student.nisn),
  ].filter(Boolean).includes(normalizedLogStudentId);
};

const getTeacherRatingKeyCandidates = (
  student: { id?: string | number; nisn?: string | number },
  month: number,
  year: number
) =>
  [
    `${normalizeIdentity(student.id)}_${month}_${year}`,
    `${normalizeIdentity(student.nisn)}_${month}_${year}`,
  ].filter((value, index, array) => value !== `_${month}_${year}` && array.indexOf(value) === index);

export default function SevenHabitsPage() {
  const dropdownClassName =
    "w-full rounded-lg border border-slate-500/70 bg-slate-950/90 px-3 py-2.5 text-sm font-medium text-slate-50 shadow-sm outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/60";
  const compactDropdownClassName =
    "block w-full rounded-md border border-slate-500/70 bg-slate-950/90 py-1.5 pl-3 pr-8 text-sm font-medium text-slate-50 shadow-sm outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/60";
  const dropdownStyle = { backgroundColor: "#020617", color: "#f8fafc", colorScheme: "dark" as const };
  const dropdownOptionStyle = { backgroundColor: "#020617", color: "#f8fafc" };
  const { user } = useAuthStore();
  const { students } = useStudentStore();
  const { classes } = useClassStore();
  const { logs, teacherRatings, setTeacherRating, initSevenHabitsSync, toggleHabit } = useSevenHabitsStore();
  const studentIdentityCandidates = [String(user?.nisn || "").trim(), String(user?.id || "").trim()].filter(Boolean);
  const studentWriteId = studentIdentityCandidates[0] || "";
  const [viewMode, setViewMode] = useState<'monitoring' | 'grading'>('monitoring');

  // Date State
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1); // 1-12
  const [selectedWeek, setSelectedWeek] = useState<number>(Math.ceil(currentDate.getDate() / 7));
  const [selectedDayName, setSelectedDayName] = useState<string>(DAYS[currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1]); // Default to today's day name

  // Class Navigation State
  const [selectedGrade, setSelectedGrade] = useState<"VII" | "VIII" | "IX">("VII");
  const [selectedClassName, setSelectedClassName] = useState<string>("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");

  // Rubric Modal State
  const [isRubricModalOpen, setIsRubricModalOpen] = useState(false);
  const [currentStudentForRubric, setCurrentStudentForRubric] = useState<{id: string, name: string} | null>(null);
  const [rubricValues, setRubricValues] = useState<TeacherRubric>({
    honesty: DEFAULT_TEACHER_RUBRIC.honesty,
    behavior: DEFAULT_TEACHER_RUBRIC.behavior,
    initiative: DEFAULT_TEACHER_RUBRIC.initiative,
    commitment: DEFAULT_TEACHER_RUBRIC.commitment,
    total: DEFAULT_TEACHER_RUBRIC.total,
  });

  // Get classes for the selected grade
  const gradeClasses = classes
    .filter((c) => c.grade === selectedGrade)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Set default class
  useEffect(() => {
    if (gradeClasses.length > 0) {
      const currentExists = gradeClasses.some(c => c.name === selectedClassName);
      if (!currentExists) {
        setSelectedClassName(gradeClasses[0].name);
      }
    } else {
      setSelectedClassName("");
    }
  }, [selectedGrade, classes, gradeClasses, selectedClassName]);

  useEffect(() => {
    setSelectedStudentId("");
  }, [selectedClassName]);

  useEffect(() => {
    const unsubscribe = initSevenHabitsSync();
    return () => unsubscribe();
  }, [initSevenHabitsSync]);

  const openRubricModal = (studentId: string, studentName: string) => {
    const student = students.find((item) => normalizeIdentity(item.id) === normalizeIdentity(studentId));
    const existingRubric = getTeacherRatingKeyCandidates(
      { id: studentId, nisn: student?.nisn },
      selectedMonth,
      selectedYear
    ).map((key) => teacherRatings[key]).find(Boolean);
    
    if (existingRubric) {
      setRubricValues(existingRubric);
    } else {
      setRubricValues(DEFAULT_TEACHER_RUBRIC);
    }
    
    setCurrentStudentForRubric({ id: studentId, name: studentName });
    setIsRubricModalOpen(true);
  };

  const updateRubricValue = (field: keyof Omit<TeacherRubric, 'total'>, value: number) => {
    const newValue = Math.min(25, Math.max(0, value)); // Clamp 0-25
    setRubricValues(prev => {
      const updated = { ...prev, [field]: newValue };
      updated.total = updated.honesty + updated.behavior + updated.initiative + updated.commitment;
      return updated;
    });
  };

  const saveRubric = async () => {
    if (currentStudentForRubric) {
      try {
        await setTeacherRating(currentStudentForRubric.id, selectedMonth, selectedYear, rubricValues);
        toast.success("Nilai guru berhasil disimpan.");
        setIsRubricModalOpen(false);
      } catch (error: any) {
        toast.error(error?.message || "Gagal menyimpan nilai guru.");
      }
    }
  };

  // STUDENT VIEW
  if (user?.role === 'student') {
    // Helper to calculate target date for a specific day index in the selected week/month/year
    const getTargetDateForCell = (dayIndex: number) => {
        // Robust Calculation:
        // Get all days in the month
        const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
        
        // Filter dates that fall into the selected week (1-4)
        // Definition: Week 1 = Days 1-7, Week 2 = 8-14, etc. (Simple 7-day chunks)
        const startDay = (selectedWeek - 1) * 7 + 1;
        const endDay = Math.min(startDay + 6, daysInMonth);
        
        // Find the date in this range that matches dayIndex
        // dayIndex 0 = Senin (Monday), 6 = Minggu (Sunday)
        for (let d = startDay; d <= endDay; d++) {
            const currentCheckDate = new Date(selectedYear, selectedMonth - 1, d);
            const currentDayIndex = currentCheckDate.getDay() === 0 ? 6 : currentCheckDate.getDay() - 1;
            if (currentDayIndex === dayIndex) {
                return currentCheckDate;
            }
        }
        return null;
    };

    // Helper to check if a habit is completed for a specific day index (0=Senin, 6=Minggu)
    const isHabitCompleted = (habitKey: keyof HabitLog['habits'], dayIndex: number) => {
        const targetDate = getTargetDateForCell(dayIndex);
        if (!targetDate) return false;

        const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
        
        // Find log by exact date string and student ID
        const log = logs.find(l => {
            if (!studentIdentityCandidates.includes(String(l.studentId))) return false;
            return l.date === dateStr;
        });

        return log?.habits[habitKey] || false;
    };

    const handleToggle = (habitKey: keyof HabitLog['habits'], dayIndex: number) => {
        const targetDate = getTargetDateForCell(dayIndex);
        
        if (targetDate) {
            const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
            const currentState = isHabitCompleted(habitKey, dayIndex);
            
            if (studentWriteId) {
                toggleHabit(studentWriteId, dateStr, habitKey, !currentState);
            } else {
                toast.error("User ID not found");
            }
        } else {
            toast.error("Tanggal tidak valid untuk minggu ini");
        }
    };

    const habitsList = [
        { id: 'habit1', title: 'Bangun Pagi', desc: 'Bangun sebelum pukul 05.00 WIB' },
        { id: 'habit2', title: 'Beribadah', desc: 'Melaksanakan ibadah sesuai agama dan kepercayaan' },
        { id: 'habit3', title: 'Berolahraga', desc: 'Melakukan aktivitas fisik minimal 30 menit' },
        { id: 'habit4', title: 'Makan Sehat dan Bergizi', desc: 'Mengonsumsi makanan bergizi seimbang (4 sehat 5 sempurna)' },
        { id: 'habit5', title: 'Gemar Belajar', desc: 'Membaca buku, mengerjakan tugas, dan belajar mandiri' },
        { id: 'habit6', title: 'Bermasyarakat', desc: 'Bersosialisasi, membantu orang lain, dan aktif di lingkungan' },
        { id: 'habit7', title: 'Tidur Awal', desc: 'Tidur maksimal pukul 21.00 WIB untuk menjaga kesehatan' }, // Added habit 7 description
    ];

    return (
       <div className="space-y-6 max-w-2xl mx-auto">
         {/* Header with Back Button */}
         <div className="flex items-center gap-4">
             {/* Note: In APK there is a back button. In Web Dashboard context, maybe not needed if it's a main menu. 
                 But to match APK layout, we can keep the title structure. */}
             <div>
                 <h1 className="text-2xl font-bold text-slate-100">7 KAIH</h1>
             </div>
         </div>

         <div className="glass-effect-dark-card rounded-xl p-6 shadow-sm border border-slate-700">
           <h2 className="text-lg font-bold text-slate-100 mb-4">Checklist Mingguan</h2>
           
           {/* Filters: Year & Month */}
           <div className="grid grid-cols-2 gap-4 mb-6">
               <div className="space-y-1">
                   <label className="text-xs text-slate-400 ml-1">Tahun</label>
                   <select 
                       value={selectedYear} 
                       onChange={(e) => setSelectedYear(Number(e.target.value))}
                       className={dropdownClassName}
                       style={dropdownStyle}
                   >
                       {YEARS.map(y => <option key={y} value={y} style={dropdownOptionStyle}>{y}</option>)}
                   </select>
               </div>
               <div className="space-y-1">
                   <label className="text-xs text-slate-400 ml-1">Bulan</label>
                   <select 
                       value={selectedMonth} 
                       onChange={(e) => setSelectedMonth(Number(e.target.value))}
                       className={dropdownClassName}
                       style={dropdownStyle}
                   >
                       {MONTHS.map((m, i) => <option key={i} value={i + 1} style={dropdownOptionStyle}>{m}</option>)}
                   </select>
               </div>
           </div>

           {/* Week Selector */}
           <div className="space-y-1 mb-6">
               <label className="text-xs text-slate-400 ml-1">Pilih Minggu:</label>
               <div className="grid grid-cols-5 gap-2">
                   {WEEKS.map(({ value: week }) => (
                       <button
                           key={week}
                           onClick={() => setSelectedWeek(week)}
                           className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                               selectedWeek === week
                               ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm'
                               : 'glass-effect-dark-card border-slate-700 text-slate-400 hover:bg-slate-900/30'
                           }`}
                       >
                           <span className="block text-[10px] text-slate-400 font-normal">Minggu</span>
                           <span className="text-lg font-bold">{week}</span>
                       </button>
                   ))}
               </div>
           </div>

           {/* Checklist Table */}
           <div className="border border-slate-700 rounded-lg overflow-hidden mb-6">
               <table className="w-full text-sm text-left">
                   <thead className="bg-blue-600 text-white">
                       <tr>
                           <th className="px-3 py-3 w-10 text-center border-r border-blue-500">No</th>
                           <th className="px-3 py-3 border-r border-blue-500">Kebiasaan</th>
                           {DAYS.map(day => (
                               <th key={day} className="px-1 py-3 text-center w-8 text-[10px] border-r border-blue-500 last:border-r-0">
                                   {day.substring(0, 2)}
                               </th>
                           ))}
                       </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-200">
                       {habitsList.map((habit, index) => (
                           <tr key={habit.id} className="hover:bg-slate-900/30">
                               <td className="px-3 py-4 text-center border-r border-slate-700 font-medium text-slate-400">
                                   {index + 1}
                               </td>
                               <td className="px-3 py-4 border-r border-slate-700">
                                   <p className="font-bold text-slate-100 text-xs sm:text-sm">{habit.title}</p>
                                   <p className="text-[10px] text-slate-400 leading-tight mt-0.5 line-clamp-2">{habit.desc}</p>
                               </td>
                               {DAYS.map((_, dayIndex) => {
                                   const isCompleted = isHabitCompleted(habit.id as any, dayIndex);
                                   return (
                                       <td key={dayIndex} className="px-1 py-2 text-center border-r border-slate-700 last:border-r-0 relative group">
                                            <div 
                                                onClick={() => handleToggle(habit.id as any, dayIndex)}
                                                className={`w-5 h-5 mx-auto rounded border flex items-center justify-center transition-colors cursor-pointer ${
                                                isCompleted 
                                                ? 'bg-blue-600 border-blue-600' 
                                                : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                                            }`}>
                                                {isCompleted && <Check className="w-3.5 h-3.5 text-white" />}
                                            </div>
                                       </td>
                                   );
                               })}
                           </tr>
                       ))}
                   </tbody>
               </table>
           </div>

           {/* Submit Button */}
           <button
                type="button"
                disabled
                className="w-full cursor-not-allowed py-3.5 bg-slate-700/70 text-slate-200 rounded-full font-bold shadow-lg opacity-80"
                title="Setiap perubahan checklist langsung tersimpan otomatis."
           >
               Tersimpan Otomatis
           </button>

         </div>
       </div>
    );
  }



  // Filter students by class
  const classStudents = students.filter(student => 
    student.class === selectedClassName
  );

  // Helper to get date string from Year/Month/Week/Day selection
  // This is an approximation since "Week 1" logic can vary.
  // Ideally we should just filter logs by week/month/year and then find the one that matches the day name.
  // But wait, logs store 'date'. We need to match day name.
  
  const getStudentLog = (studentId: string) => {
    const student = classStudents.find((item) => normalizeIdentity(item.id) === normalizeIdentity(studentId));
    if (!student) return undefined;

    // Filter logs by year, month, week, and student
    // AND match the day name (Senin, Selasa, etc)
    return logs.find(log => {
      if (!matchesStudentIdentity(student, log.studentId)) return false;
      if (log.year !== selectedYear) return false;
      if (log.month !== selectedMonth) return false;
      if (log.week !== selectedWeek) return false;
      
      // Check day name safely
      const [y, m, d] = log.date.split('-').map(Number);
      const logDate = new Date(y, m - 1, d); // Local date constructor
      const dayIndex = logDate.getDay() === 0 ? 6 : logDate.getDay() - 1; // 0=Senin, 6=Minggu
      return DAYS[dayIndex] === selectedDayName;
    });
  };


  const gradingData = classStudents.map(student => {
    const studentLogs = logs.filter(l => 
      matchesStudentIdentity(student, l.studentId) && 
      l.month === selectedMonth && 
      l.year === selectedYear
    );
    
    const storedRubric = getTeacherRatingKeyCandidates(student, selectedMonth, selectedYear)
      .map((key) => teacherRatings[key])
      .find(Boolean);
    const effectiveRubric = storedRubric ?? DEFAULT_TEACHER_RUBRIC;
    const teacherRating = effectiveRubric.total;

    return {
      student,
      rubric: storedRubric || null,
      ...calculateHabitGrades(studentLogs, teacherRating)
    };
  });

  const daysInSelectedMonth = Array.from(
    { length: new Date(selectedYear, selectedMonth, 0).getDate() }, 
    (_, i) => i + 1
  );

  const getStudentLogByDate = (studentId: string, date: number) => {
    const student = classStudents.find((item) => normalizeIdentity(item.id) === normalizeIdentity(studentId));
    if (!student) return undefined;

    // Construct date string YYYY-MM-DD
    // Note: selectedMonth is 1-based, need to pad
    const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    return logs.find(l => matchesStudentIdentity(student, l.studentId) && l.date === dateStr);
  };

  const handleExport = () => {
    if (viewMode === 'grading') {
      const exportData = gradingData.map(data => ({
        'Nama Siswa': data.student.name,
        'NISN': data.student.nisn,
        'Kelas': data.student.class,
        'Periode': `${MONTHS[selectedMonth-1]} ${selectedYear}`,
        'Konsistensi Harian (40%)': data.dailyConsistency.toFixed(1),
        'Progress Mingguan (30%)': data.weeklyProgress.toFixed(1),
        'Pencapaian Bulanan (20%)': data.monthlyAchievement.toFixed(1),
        'Nilai Guru (10%)': data.teacherRating,
        'Nilai Akhir': data.finalScore.toFixed(1),
        'Predikat': data.predicate,
        'Kategori': data.category
      }));
      exportToExcel(exportData, `Nilai_7Habits_${selectedClassName}_${MONTHS[selectedMonth-1]}_${selectedYear}`);
      return;
    }

    // Generate data for all students in the class for the selected period
    // Since logs are daily, we might want to export summary or daily details.
    // Let's export the daily view as seen on screen + summary if needed.
    // Actually, users usually want raw data. Let's export the current table view.
    
    const exportData = classStudents.map(student => {
      const log = getStudentLog(student.id);
      const habits = log?.habits;
      
      return {
        'Nama Siswa': student.name,
        'NISN': student.nisn,
        'Kelas': student.class,
        'Tanggal': `${selectedDayName}, ${selectedWeek} ${MONTHS[selectedMonth-1]} ${selectedYear}`,
        'Bangun Pagi': habits?.habit1 ? 'Ya' : 'Tidak',
        'Beribadah': habits?.habit2 ? 'Ya' : 'Tidak',
        'Berolahraga': habits?.habit3 ? 'Ya' : 'Tidak',
        'Makan Sehat': habits?.habit4 ? 'Ya' : 'Tidak',
        'Gemar Belajar': habits?.habit5 ? 'Ya' : 'Tidak',
        'Bermasyarakat': habits?.habit6 ? 'Ya' : 'Tidak',
        'Tidur Awal': habits?.habit7 ? 'Ya' : 'Tidak',
      };
    });

    exportToExcel(exportData, `Laporan_7Habits_${selectedClassName}_${selectedDayName}_${MONTHS[selectedMonth-1]}_${selectedYear}`);
  };

  return (
    <div className="space-y-6">
      {/* Print Header */}
      <div className="hidden print:block mb-8">
        <div className="text-center border-b-2 border-gray-800 pb-4 mb-4">
          <h1 className="text-xl font-bold uppercase">Pemerintah Kabupaten Mojokerto</h1>
          <h2 className="text-2xl font-bold uppercase">UPT SMP Negeri 3 Pacet</h2>
          <p className="text-sm">Jl. Raya Pacet No. 12, Kec. Pacet, Kab. Mojokerto, Jawa Timur</p>
          <p className="text-sm italic">Website: www.smpn3pacet.sch.id | Email: info@smpn3pacet.sch.id</p>
        </div>
        <div className="text-center mb-6">
          <h3 className="text-lg font-bold underline">LAPORAN CAPAIAN 7 KEBIASAAN ANAK INDONESIA HEBAT (7 KAIH)</h3>
          {/* If student selected, show student details here instead of generic class info */}
          {!selectedStudentId ? (
            <p className="text-sm mt-1">
              Kelas: {selectedClassName || selectedGrade} | 
              Periode: {MONTHS[selectedMonth - 1]} {selectedYear} - {WEEKS.find(w => w.value === selectedWeek)?.label} ({selectedDayName})
            </p>
          ) : (
            <div className="mt-2 text-sm">
              <p className="font-bold text-lg">{classStudents.find(s => s.id === selectedStudentId)?.name}</p>
              <p>NISN: {classStudents.find(s => s.id === selectedStudentId)?.nisn} | Kelas: {classStudents.find(s => s.id === selectedStudentId)?.class}</p>
              <p>Periode: {MONTHS[selectedMonth - 1]} {selectedYear}</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Laporan 7 Kebiasaan (7 KAIH)</h1>
          <p className="mt-1 text-sm text-slate-400">
            Monitoring pelaksanaan 7 Kebiasaan Anak Indonesia Hebat
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="bg-slate-800/50 p-1 rounded-lg flex items-center mr-4">
            <button
              onClick={() => setViewMode('monitoring')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                viewMode === 'monitoring' 
                  ? 'glass-effect-dark-card text-slate-100 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <Calendar className="w-4 h-4 inline-block mr-1.5" />
              Monitoring
            </button>
            <button
              onClick={() => setViewMode('grading')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                viewMode === 'grading' 
                  ? 'glass-effect-dark-card text-indigo-600 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <GraduationCap className="w-4 h-4 inline-block mr-1.5" />
              Penilaian
            </button>
          </div>

          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Cetak Laporan
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 glass-effect-dark-card p-2 rounded-md shadow-sm border print:hidden">
          {/* Year Selector */}
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-slate-400">Tahun:</span>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className={compactDropdownClassName}
              style={dropdownStyle}
            >
              {YEARS.map((year) => (
                <option key={year} value={year} style={dropdownOptionStyle}>{year}</option>
              ))}
            </select>
          </div>

          {/* Month Selector */}
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-slate-400">Bulan:</span>
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className={compactDropdownClassName}
              style={dropdownStyle}
            >
              {MONTHS.map((month, index) => (
                <option key={month} value={index + 1} style={dropdownOptionStyle}>{month}</option>
              ))}
            </select>
          </div>

          {/* Week Selector */}
          {viewMode === 'monitoring' && !selectedStudentId && (
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium text-slate-400">Minggu:</span>
              <select 
                value={selectedWeek} 
                onChange={(e) => setSelectedWeek(Number(e.target.value))}
                className={compactDropdownClassName}
                style={dropdownStyle}
              >
                {WEEKS.map((week) => (
                  <option key={week.value} value={week.value} style={dropdownOptionStyle}>{week.label}</option>
                ))}
              </select>
            </div>
          )}

           {/* Day Selector */}
           {viewMode === 'monitoring' && !selectedStudentId && (
             <div className="flex items-center gap-1">
              <span className="text-xs font-medium text-slate-400">Hari:</span>
              <select 
                value={selectedDayName} 
                onChange={(e) => setSelectedDayName(e.target.value)}
                className={compactDropdownClassName}
                style={dropdownStyle}
              >
                {DAYS.map((day) => (
                  <option key={day} value={day} style={dropdownOptionStyle}>{day}</option>
                ))}
              </select>
            </div>
           )}
        </div>

      {/* Grade Tabs */}
      <div className="border-b border-slate-700 print:hidden">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {(["VII", "VIII", "IX"] as const).map((grade) => (
            <button
              key={grade}
              onClick={() => setSelectedGrade(grade)}
              className={`${
                selectedGrade === grade
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-slate-400 hover:border-gray-300 hover:text-slate-300"
              } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
            >
              Kelas {grade}
            </button>
          ))}
        </nav>
      </div>

      {/* Class Pills */}
      {gradeClasses.length > 0 ? (
        <div className="flex flex-wrap gap-2 print:hidden">
          {gradeClasses.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedClassName(c.name)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                selectedClassName === c.name
                  ? "bg-blue-100 text-blue-800"
                  : "bg-slate-800/50 text-slate-400 hover:bg-gray-200"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      ) : (
        <div className="text-sm text-slate-400 italic print:hidden">Belum ada data kelas untuk tingkat ini.</div>
      )}

      {/* Student Selector */}
      {selectedClassName && classStudents.length > 0 && (
        <div className="print:hidden">
            <label htmlFor="student-select" className="block text-sm font-medium text-slate-300 mb-1">
                Pilih Siswa (Opsional)
            </label>
            <select
                id="student-select"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className={`${compactDropdownClassName} max-w-xs pr-10`}
                style={dropdownStyle}
            >
                <option value="" style={dropdownOptionStyle}>-- Tampilkan Semua Siswa --</option>
                {classStudents.map((student) => (
                    <option key={student.id} value={student.id} style={dropdownOptionStyle}>
                        {student.name}
                    </option>
                ))}
            </select>
        </div>
      )}

      {/* Table */}
      <div className="glass-effect-dark-card shadow-sm ring-1 ring-gray-900/5 sm:rounded-lg overflow-hidden print:shadow-none print:ring-0">
        <div className="overflow-x-auto">
          {selectedStudentId ? (
            viewMode === 'monitoring' ? (
              <table className="min-w-full divide-y divide-gray-300 print:divide-gray-900 print:border print:border-gray-900">
                <thead className="bg-slate-900/30 print:bg-slate-800/50">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-100 sm:pl-6 print:border print:border-gray-900">Tanggal</th>
                    <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-slate-100 print:border print:border-gray-900">Bangun Pagi</th>
                    <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-slate-100 print:border print:border-gray-900">Beribadah</th>
                    <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-slate-100 print:border print:border-gray-900">Berolahraga</th>
                    <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-slate-100 print:border print:border-gray-900">Makan Sehat</th>
                    <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-slate-100 print:border print:border-gray-900">Gemar Belajar</th>
                    <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-slate-100 print:border print:border-gray-900">Bermasyarakat</th>
                    <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-slate-100 print:border print:border-gray-900">Tidur Awal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 glass-effect-dark-card print:divide-gray-900">
                  {daysInSelectedMonth.map(date => {
                    const log = getStudentLogByDate(selectedStudentId, date);
                    const habits = log?.habits;
                    const dateObj = new Date(selectedYear, selectedMonth - 1, date);
                    const dayName = DAYS[dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1];

                    return (
                      <tr key={date}>
                        <td className="whitespace-nowrap py-2 pl-4 pr-3 text-sm font-medium text-slate-100 sm:pl-6 print:border print:border-gray-900">
                          {date} {MONTHS[selectedMonth-1]} <span className="text-slate-400 font-normal">({dayName})</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-sm text-center print:border print:border-gray-900">
                          {habits?.habit1 ? <Check className="mx-auto h-4 w-4 text-green-500 print:text-black" /> : <span className="text-gray-300 print:text-gray-200">-</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-sm text-center print:border print:border-gray-900">
                          {habits?.habit2 ? <Check className="mx-auto h-4 w-4 text-green-500 print:text-black" /> : <span className="text-gray-300 print:text-gray-200">-</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-sm text-center print:border print:border-gray-900">
                          {habits?.habit3 ? <Check className="mx-auto h-4 w-4 text-green-500 print:text-black" /> : <span className="text-gray-300 print:text-gray-200">-</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-sm text-center print:border print:border-gray-900">
                          {habits?.habit4 ? <Check className="mx-auto h-4 w-4 text-green-500 print:text-black" /> : <span className="text-gray-300 print:text-gray-200">-</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-sm text-center print:border print:border-gray-900">
                          {habits?.habit5 ? <Check className="mx-auto h-4 w-4 text-green-500 print:text-black" /> : <span className="text-gray-300 print:text-gray-200">-</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-sm text-center print:border print:border-gray-900">
                          {habits?.habit6 ? <Check className="mx-auto h-4 w-4 text-green-500 print:text-black" /> : <span className="text-gray-300 print:text-gray-200">-</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-sm text-center print:border print:border-gray-900">
                          {habits?.habit7 ? <Check className="mx-auto h-4 w-4 text-green-500 print:text-black" /> : <span className="text-gray-300 print:text-gray-200">-</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-6">
                <h3 className="text-lg font-medium leading-6 text-slate-100 mb-4">Detail Penilaian Siswa</h3>
                {(() => {
                  const studentData = gradingData.find(d => d.student.id === selectedStudentId);
                  if (!studentData) return <div>Data siswa tidak ditemukan</div>;
                  
                  return (
                    <div className="bg-slate-900/30 rounded-lg p-6 border border-slate-700 print:glass-effect-dark-card print:border-none print:p-0">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:block">
                        <div className="print:hidden">
                          <p className="text-sm text-slate-400">Nama Siswa</p>
                          <p className="text-lg font-bold">{studentData.student.name}</p>
                          <p className="text-sm text-slate-400 mt-2">NISN</p>
                          <p className="font-medium">{studentData.student.nisn}</p>
                          <p className="text-sm text-slate-400 mt-2">Kelas</p>
                          <p className="font-medium">{studentData.student.class}</p>
                        </div>
                        <div className="space-y-4 print:space-y-2">
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-slate-400">Konsistensi Harian (40%)</span>
                            <span className="font-bold">{studentData.dailyConsistency.toFixed(1)}</span>
                          </div>
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-slate-400">Progress Mingguan (30%)</span>
                            <span className="font-bold">{studentData.weeklyProgress.toFixed(1)}</span>
                          </div>
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-slate-400">Pencapaian Bulanan (20%)</span>
                            <span className="font-bold">{studentData.monthlyAchievement.toFixed(1)}</span>
                          </div>
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-slate-400">Nilai Guru (10%)</span>
                            <div className="flex items-center gap-2">
                              <span className="font-bold print:block hidden">{studentData.teacherRating}</span>
                              <button
                                onClick={() => openRubricModal(studentData.student.id, studentData.student.name)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold text-indigo-600 hover:bg-indigo-50 ring-1 ring-inset ring-indigo-100 print:hidden"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                {studentData.teacherRating > 0 ? studentData.teacherRating : "Input"}
                              </button>
                            </div>
                          </div>
                          <div className="flex justify-between items-center pt-2">
                            <span className="text-lg font-bold text-slate-100">Nilai Akhir</span>
                            <span className="text-2xl font-bold text-indigo-600">{studentData.finalScore.toFixed(1)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400">Predikat</span>
                            <span className={`inline-flex items-center rounded-md px-2 py-1 text-sm font-medium ring-1 ring-inset ${
                              studentData.predicate.startsWith('A') ? 'bg-green-50 text-green-700 ring-green-600/20' :
                              studentData.predicate.startsWith('B') ? 'bg-blue-50 text-blue-700 ring-blue-600/20' :
                              studentData.predicate.startsWith('C') ? 'bg-yellow-50 text-yellow-700 ring-yellow-600/20' :
                              'bg-red-50 text-red-700 ring-red-600/20'
                            }`}>
                              {studentData.predicate}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )
          ) : (
           viewMode === 'monitoring' ? (
            <table className="min-w-full divide-y divide-gray-300 print:divide-gray-900 print:border print:border-gray-900">
              <thead className="bg-slate-900/30 print:bg-slate-800/50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-100 sm:pl-6 print:border print:border-gray-900">
                    Nama Siswa
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-slate-100 print:border print:border-gray-900">
                    Bangun Pagi
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-slate-100 print:border print:border-gray-900">
                    Beribadah
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-slate-100 print:border print:border-gray-900">
                    Berolahraga
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-slate-100 print:border print:border-gray-900">
                    Makan Sehat
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-slate-100 print:border print:border-gray-900">
                    Gemar Belajar
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-slate-100 print:border print:border-gray-900">
                    Bermasyarakat
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-slate-100 print:border print:border-gray-900">
                    Tidur Awal
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 glass-effect-dark-card print:divide-gray-900">
                {classStudents.length > 0 ? (
                  classStudents.map((student) => {
                    const log = getStudentLog(student.id);
                    const habits = log?.habits;

                    return (
                      <tr key={student.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-100 sm:pl-6 print:border print:border-gray-900">
                          {student.name}
                          <div className="text-xs text-slate-400 font-normal">{student.nisn}</div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-400 text-center print:border print:border-gray-900">
                          {habits?.habit1 ? <Check className="mx-auto h-5 w-5 text-green-500 print:text-black" /> : <span className="text-gray-300 print:text-gray-200">-</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-400 text-center print:border print:border-gray-900">
                          {habits?.habit2 ? <Check className="mx-auto h-5 w-5 text-green-500 print:text-black" /> : <span className="text-gray-300 print:text-gray-200">-</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-400 text-center print:border print:border-gray-900">
                          {habits?.habit3 ? <Check className="mx-auto h-5 w-5 text-green-500 print:text-black" /> : <span className="text-gray-300 print:text-gray-200">-</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-400 text-center print:border print:border-gray-900">
                          {habits?.habit4 ? <Check className="mx-auto h-5 w-5 text-green-500 print:text-black" /> : <span className="text-gray-300 print:text-gray-200">-</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-400 text-center print:border print:border-gray-900">
                          {habits?.habit5 ? <Check className="mx-auto h-5 w-5 text-green-500 print:text-black" /> : <span className="text-gray-300 print:text-gray-200">-</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-400 text-center print:border print:border-gray-900">
                          {habits?.habit6 ? <Check className="mx-auto h-5 w-5 text-green-500 print:text-black" /> : <span className="text-gray-300 print:text-gray-200">-</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-400 text-center print:border print:border-gray-900">
                          {habits?.habit7 ? <Check className="mx-auto h-5 w-5 text-green-500 print:text-black" /> : <span className="text-gray-300 print:text-gray-200">-</span>}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-sm text-slate-400 print:border print:border-gray-900">
                      Tidak ada siswa di kelas ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-slate-900/30">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-100 sm:pl-6">Nama Siswa</th>
                  <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-slate-100">Konsistensi Harian (40%)</th>
                  <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-slate-100">Progress Mingguan (30%)</th>
                  <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-slate-100">Pencapaian Bulanan (20%)</th>
                  <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-slate-100">Nilai Guru (10%)</th>
                  <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-slate-100">Nilai Akhir</th>
                  <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-slate-100">Predikat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 glass-effect-dark-card">
                {gradingData.length > 0 ? (
                  gradingData.map((data) => (
                    <tr key={data.student.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-100 sm:pl-6">
                        {data.student.name}
                        <div className="text-xs text-slate-400 font-normal">{data.student.nisn}</div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-400 text-center">
                        {data.dailyConsistency.toFixed(1)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-400 text-center">
                        {data.weeklyProgress.toFixed(1)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-400 text-center">
                        {data.monthlyAchievement.toFixed(1)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-400 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openRubricModal(data.student.id, data.student.name)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold text-indigo-600 hover:bg-indigo-50 ring-1 ring-inset ring-indigo-100"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            {data.teacherRating > 0 ? data.teacherRating : "Input"}
                          </button>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-slate-100 text-center">
                        {data.finalScore.toFixed(1)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-400 text-center">
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                          data.predicate.startsWith('A') ? 'bg-green-50 text-green-700 ring-green-600/20' :
                          data.predicate.startsWith('B') ? 'bg-blue-50 text-blue-700 ring-blue-600/20' :
                          data.predicate.startsWith('C') ? 'bg-yellow-50 text-yellow-700 ring-yellow-600/20' :
                          'bg-red-50 text-red-700 ring-red-600/20'
                        }`}>
                          {data.predicate}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-sm text-slate-400">
                      Tidak ada siswa di kelas ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )
          )}
        </div>
      </div>

      {/* Signature Section */}
      <div className="hidden print:flex justify-between mt-8 pt-8 page-break-inside-avoid px-8">
        <div className="text-center w-64">
          <p className="mb-20">Mengetahui,<br/>Orang Tua/Wali Murid</p>
          <p className="font-bold underline">.............................................</p>
        </div>
        <div className="text-center w-64">
          <p className="mb-20">Pacet, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br/>Wali Kelas {selectedClassName}</p>
          <p className="font-bold underline">.............................................</p>
          <p>NIP. .............................................</p>
        </div>
      </div>

      {/* Rubric Modal */}
      {isRubricModalOpen && currentStudentForRubric && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:hidden">
          <div className="w-full max-w-md glass-effect-dark-card rounded-lg shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700 bg-slate-900/30 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-slate-100">Penilaian Guru</h3>
                <p className="text-sm text-slate-400">{currentStudentForRubric.name}</p>
              </div>
              <button 
                onClick={() => setIsRubricModalOpen(false)}
                className="text-gray-400 hover:text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="px-6 py-4 space-y-6">
              {/* Kejujuran */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-slate-300">Kejujuran (0-25)</label>
                  <span className="text-sm font-bold text-indigo-600">{rubricValues.honesty}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="25"
                  step="1"
                  value={rubricValues.honesty}
                  onChange={(e) => updateRubricValue('honesty', Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <p className="text-xs text-slate-400 mt-1">Siswa mengisi jurnal dengan jujur dan konsisten</p>
              </div>

              {/* Perubahan Perilaku */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-slate-300">Perubahan Perilaku (0-25)</label>
                  <span className="text-sm font-bold text-indigo-600">{rubricValues.behavior}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="25"
                  step="1"
                  value={rubricValues.behavior}
                  onChange={(e) => updateRubricValue('behavior', Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <p className="text-xs text-slate-400 mt-1">Terlihat perubahan positif dalam keseharian</p>
              </div>

              {/* Inisiatif */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-slate-300">Inisiatif (0-25)</label>
                  <span className="text-sm font-bold text-indigo-600">{rubricValues.initiative}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="25"
                  step="1"
                  value={rubricValues.initiative}
                  onChange={(e) => updateRubricValue('initiative', Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <p className="text-xs text-slate-400 mt-1">Proaktif melakukan kebiasaan tanpa disuruh</p>
              </div>

              {/* Komitmen */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-slate-300">Komitmen (0-25)</label>
                  <span className="text-sm font-bold text-indigo-600">{rubricValues.commitment}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="25"
                  step="1"
                  value={rubricValues.commitment}
                  onChange={(e) => updateRubricValue('commitment', Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <p className="text-xs text-slate-400 mt-1">Menunjukkan komitmen perbaikan berkelanjutan</p>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-900/30 flex justify-between items-center border-t border-slate-700">
              <div className="flex flex-col">
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Skor</span>
                <span className="text-2xl font-bold text-indigo-600">{rubricValues.total}</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsRubricModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-300 glass-effect-dark-card border border-gray-300 rounded-md hover:bg-slate-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Batal
                </button>
                <button
                  onClick={saveRubric}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-sm"
                >
                  Simpan Nilai
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

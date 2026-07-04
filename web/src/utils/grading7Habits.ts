import { HabitLog } from "@/store/useSevenHabitsStore";

export interface GradingResult {
  dailyConsistency: number;
  weeklyProgress: number;
  monthlyAchievement: number;
  teacherRating: number;
  finalScore: number;
  predicate: string;
  category: string;
  description: string;
}

export const calculateHabitGrades = (
  logs: HabitLog[],
  teacherRating: number = 0 // 0-100
): GradingResult => {
  if (logs.length === 0) {
    return {
      dailyConsistency: 0,
      weeklyProgress: 0,
      monthlyAchievement: 0,
      teacherRating: teacherRating,
      finalScore: teacherRating * 0.1, // Only teacher rating contributes
      predicate: "E",
      category: "Perlu Perbaikan",
      description: "Tidak konsisten, perlu intervensi"
    };
  }

  // 1. Daily Consistency (Konsistensi Harian)
  // Formula: Average of [(Daily Completed / 7) * 100]
  let totalDailyScore = 0;
  logs.forEach(log => {
    const completedCount = Object.values(log.habits).filter(Boolean).length;
    const dailyScore = (completedCount / 7) * 100;
    totalDailyScore += dailyScore;
  });
  const dailyConsistency = Math.min(100, totalDailyScore / logs.length);

  // 2. Weekly Progress (Progress Mingguan)
  // Formula: Average of [(Weekly Ticks / 49) * 100]
  // First, group by week
  const weeklyTicks: Record<number, number> = {};
  logs.forEach(log => {
    const completedCount = Object.values(log.habits).filter(Boolean).length;
    weeklyTicks[log.week] = (weeklyTicks[log.week] || 0) + completedCount;
  });
  
  let totalWeeklyScore = 0;
  const weeks = Object.keys(weeklyTicks).length;
  Object.values(weeklyTicks).forEach(ticks => {
    // Max ticks per week is 49
    const weeklyScore = (ticks / 49) * 100;
    totalWeeklyScore += weeklyScore;
  });
  const weeklyProgress = weeks > 0 ? Math.min(100, totalWeeklyScore / weeks) : 0;

  // 3. Monthly Achievement (Pencapaian Bulanan)
  // Formula: (Total Monthly Ticks / 196) * 100
  let totalMonthlyTicks = 0;
  logs.forEach(log => {
    const completedCount = Object.values(log.habits).filter(Boolean).length;
    totalMonthlyTicks += completedCount;
  });
  const monthlyAchievement = Math.min(100, (totalMonthlyTicks / 196) * 100);

  // 4. Final Score (Nilai Akhir)
  // Formula: (Daily * 40%) + (Weekly * 30%) + (Monthly * 20%) + (Teacher * 10%)
  const finalScore = (
    (dailyConsistency * 0.40) +
    (weeklyProgress * 0.30) +
    (monthlyAchievement * 0.20) +
    (teacherRating * 0.10)
  );

  // 5. Predicate & Category
  let predicate = "E - Kurang";
  let category = "Perlu Perbaikan";
  let description = "Tidak konsisten, perlu intervensi";

  if (finalScore >= 95) {
    predicate = "A - Sangat Baik Sekali";
    category = "Sangat Baik Sekali";
    description = "Konsisten sempurna";
  } else if (finalScore >= 85) {
    predicate = "B - Sangat Baik";
    category = "Sangat Baik";
    description = "Konsisten baik, sedikit terlewat";
  } else if (finalScore >= 70) {
    predicate = "C - Baik";
    category = "Baik";
    description = "Cukup konsisten, perlu peningkatan";
  } else if (finalScore >= 50) {
    predicate = "D - Cukup";
    category = "Cukup";
    description = "Kurang konsisten, perlu perhatian";
  }

  return {
    dailyConsistency,
    weeklyProgress,
    monthlyAchievement,
    teacherRating,
    finalScore,
    predicate,
    category,
    description
  };
};

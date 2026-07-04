export interface PresensiScheduleLike {
  dayId: number;
  isEnabled: boolean;
}

export interface PresensiHolidayLike {
  date: string;
}

export function normalizeText(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeClassName(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

export function compareClassNames(a: string, b: string) {
  const gradeFrom = (name: string) => {
    const raw = normalizeClassName(name);
    if (raw.startsWith("VIII")) return 8;
    if (raw.startsWith("VII")) return 7;
    if (raw.startsWith("IX")) return 9;
    const compact = raw.replace(/\s+/g, "").replace(/-/g, "");
    if (compact.startsWith("7")) return 7;
    if (compact.startsWith("8")) return 8;
    if (compact.startsWith("9")) return 9;
    return 999;
  };

  const suffixFrom = (name: string) => {
    const raw = normalizeClassName(name);
    const roman = raw.match(/^(VIII|VII|IX)\s*[- ]?\s*(.*)$/);
    if (roman) return String(roman[2] || "").trim();
    const compact = raw.replace(/\s+/g, "").replace(/-/g, "");
    const numeric = compact.match(/^(7|8|9)(.*)$/);
    if (numeric) return String(numeric[2] || "").trim();
    return raw;
  };

  const gradeA = gradeFrom(a);
  const gradeB = gradeFrom(b);
  if (gradeA !== gradeB) return gradeA - gradeB;
  return suffixFrom(a).localeCompare(suffixFrom(b), "id-ID", { numeric: true, sensitivity: "base" });
}

export function toDateKey(value: Date | number | string) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildHolidaySet(holidays: PresensiHolidayLike[]) {
  return new Set((holidays || []).map((holiday) => toDateKey(holiday.date)));
}

export function getValidDatesInMonth(options: {
  year: number;
  month: number;
  schedules: PresensiScheduleLike[];
  holidays: PresensiHolidayLike[];
  today?: Date;
}) {
  const { year, month, schedules, holidays, today = new Date() } = options;
  const daysInMonth = new Date(year, month, 0).getDate();
  const holidaySet = buildHolidaySet(holidays || []);
  const enabledDayIds = new Set((schedules || []).filter((schedule) => schedule.isEnabled).map((schedule) => schedule.dayId));
  const result: Date[] = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    if (date.getTime() > new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) continue;
    if (date.getDay() === 0) continue;
    if (!enabledDayIds.has(date.getDay())) continue;
    if (holidaySet.has(toDateKey(date))) continue;
    result.push(date);
  }

  return result;
}

export function createStudentDateKey(studentId: string, dateKey: string) {
  return `${String(studentId || "").trim()}__${dateKey}`;
}

export function pickNewestLog<T extends { updatedAt?: number; createdAt?: number; date?: number }>(current: T | undefined, next: T) {
  if (!current) return next;
  const currentScore = Number(current.updatedAt || current.createdAt || current.date || 0);
  const nextScore = Number(next.updatedAt || next.createdAt || next.date || 0);
  return nextScore >= currentScore ? next : current;
}

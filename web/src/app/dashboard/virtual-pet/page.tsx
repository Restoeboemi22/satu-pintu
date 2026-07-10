"use client";

import { useState, useEffect, useMemo } from 'react';
import { limitToLast, onValue, orderByChild, query, ref } from 'firebase/database';
import { usePetStore, type PetData } from '@/store/usePetStore';
import { useStudentStore } from '@/store/useStudentStore';
import { useClassStore } from '@/store/useClassStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useTeacherStore } from '@/store/useTeacherStore';
import { edulockDb } from '@/lib/edulockFirebase';
import { 
  Search, 
  ArrowLeft,
  Activity,
  Utensils, 
  Gamepad2, 
  Moon, 
  Zap,
  LayoutDashboard,
  Trophy,
  AlertTriangle,
  PieChart,
  Gift,
  RotateCcw,
  Users,
  School,
  User,
  History
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Student } from '@/types/student';

type PetRiskAnalysis = {
  avgStatus: number;
  isDead: boolean;
  isSick: boolean;
  isSad: boolean;
  isStarving: boolean;
  isLowStatus: boolean;
  isReviveGraceActive: boolean;
  problems: string[];
};

type ReviveHistoryItem = {
  id: string;
  at: number;
  schoolId: string;
  petId: string;
  actorEmail: string;
  actorRole: string;
  health: number | null;
  happiness: number | null;
  energy: number | null;
  hunger: number | null;
};

function normalizeIdentity(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeSchoolScope(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function getStudentIdentityCandidates(student?: Partial<Student> | null) {
  if (!student) return [];

  return [
    normalizeIdentity(student.id),
    normalizeIdentity(student.nisn),
    normalizeIdentity(student.username),
  ].filter((value, index, array) => value && array.indexOf(value) === index);
}

function analyzePetRisk(pet: PetData): PetRiskAnalysis {
  const health = Number(pet.stats.health || 0);
  const happiness = Number(pet.stats.happiness || 0);
  const energy = Number(pet.stats.energy || 0);
  const hunger = Number(pet.stats.hunger || 0);
  const manualReviveUntil = Number(pet.manualReviveUntil || 0) || 0;
  const isReviveGraceActive = manualReviveUntil > Date.now();
  const fullness = Math.max(0, 100 - hunger);
  const lowestVital = Math.min(health, happiness, energy, fullness);
  const avgStatus = (health + happiness + energy + fullness) / 4;

  // Samakan definisi "mati" dengan APK siswa:
  // DEAD jika status memang DEAD atau ada vital terendah yang jatuh ke 0.
  const isDead = !isReviveGraceActive && (pet.status === 'DEAD' || health <= 0 || lowestVital <= 0);
  const isSick = pet.status === 'SICK' || health < 30 || happiness < 30;
  const isSad = pet.status === 'SAD' || happiness < 50;
  const isStarving = hunger > 70;
  const isLowStatus = avgStatus < 40 && !isDead;
  const problems: string[] = [];

  if (isDead) {
    problems.push('Mati / DEAD');
  } else {
    if (isReviveGraceActive) problems.push('Dalam masa grace revive');
    if (health < 30) problems.push(`Kesehatan kritis (${health}%)`);
    if (happiness < 30) problems.push(`Kebahagiaan kritis (${happiness}%)`);
    else if (isSad) problems.push(`Kebahagiaan rendah (${happiness}%)`);
    if (isStarving) problems.push(`Kelaparan (${hunger}%)`);
    if (isLowStatus) problems.push(`Rata-rata status buruk (${avgStatus.toFixed(0)}%)`);
  }

  return {
    avgStatus,
    isDead,
    isSick,
    isSad,
    isStarving,
    isLowStatus,
    isReviveGraceActive,
    problems,
  };
}

function derivePetCondition(pet: PetData, risk: PetRiskAnalysis) {
  const health = Number(pet.stats.health || 0);
  const happiness = Number(pet.stats.happiness || 0);
  const energy = Number(pet.stats.energy || 0);
  const hunger = Number(pet.stats.hunger || 0);
  const fullness = Math.max(0, 100 - hunger);
  const lowestVital = Math.min(health, happiness, energy, fullness);

  if (risk.isDead) {
    return {
      label: "Mati",
      className: "bg-black text-white",
      sublabel: risk.isReviveGraceActive ? "Grace aktif" : "",
    };
  }

  if (lowestVital <= 10 || risk.avgStatus < 25) {
    return {
      label: "Sekarat",
      className: "bg-red-600 text-white",
      sublabel: risk.isReviveGraceActive ? "Grace aktif" : "",
    };
  }

  if (risk.isSick || risk.isSad || risk.isStarving || risk.isLowStatus || lowestVital <= 30) {
    return {
      label: "Sakit",
      className: "bg-orange-500 text-white",
      sublabel: risk.isReviveGraceActive ? "Grace aktif" : "",
    };
  }

  return {
    label: "Sehat",
    className: "bg-green-600 text-white",
    sublabel: risk.isReviveGraceActive ? "Grace aktif" : "",
  };
}

export default function VirtualPetPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { pets, initPetSync, revivePet, resetPetLevel, giveReward } = usePetStore();
  const { syncStudents, students } = useStudentStore();
  const { classes } = useClassStore();
  const { teachers, subscribeToTeachers } = useTeacherStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'summary' | 'leaderboard' | 'risk' | 'stats' | 'rewards'>('risk');
  const [reviveHistory, setReviveHistory] = useState<ReviveHistoryItem[]>([]);

  const studentByIdentity = useMemo(() => {
    const lookup = new Map<string, Student>();

    students.forEach((student) => {
      getStudentIdentityCandidates(student).forEach((candidate) => {
        if (!lookup.has(candidate)) {
          lookup.set(candidate, student);
        }
      });
    });

    return lookup;
  }, [students]);

  const studentIdentitySet = useMemo(() => {
    const ids = new Set<string>();
    students.forEach((student) => {
      getStudentIdentityCandidates(student).forEach((candidate) => ids.add(candidate));
    });
    return ids;
  }, [students]);

  const scopedPets = useMemo(() => {
    const scopedSchoolId = normalizeSchoolScope(user?.schoolId);
    const isSuperAdmin = user?.role === 'super_admin';

    return pets.filter((pet) => {
      const normalizedStudentId = normalizeIdentity(pet.studentId);
      const matchedStudent = studentByIdentity.get(normalizedStudentId);
      const petSchoolId = normalizeSchoolScope(pet.schoolId);
      const studentSchoolId = normalizeSchoolScope(matchedStudent?.schoolId);

      if (isSuperAdmin) return true;
      if (studentIdentitySet.has(normalizedStudentId)) return true;
      if (!scopedSchoolId) return true;

      return petSchoolId === scopedSchoolId || studentSchoolId === scopedSchoolId;
    });
  }, [pets, studentByIdentity, studentIdentitySet, user?.role, user?.schoolId]);

  // Sync data
  useEffect(() => {
    const unsubPets = initPetSync(user?.schoolId);
    const unsubStudents = syncStudents(); 
    const unsubTeachers = subscribeToTeachers();
    return () => {
      unsubPets();
      unsubStudents();
      unsubTeachers();
    };
  }, [initPetSync, subscribeToTeachers, syncStudents, user?.schoolId]);

  useEffect(() => {
    if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
      setReviveHistory([]);
      return;
    }

    const scopedSchoolId = String(user.schoolId || "").trim().toLowerCase();
    const qRef = query(ref(edulockDb, "platform_events"), orderByChild("at"), limitToLast(150));
    const unsub = onValue(qRef, (snapshot) => {
      const data = snapshot.val();
      if (!data || typeof data !== "object") {
        setReviveHistory([]);
        return;
      }

      const rows = Object.values<any>(data)
        .map((item) => {
          const metadata = item?.metadata && typeof item.metadata === "object" ? item.metadata : {};
          return {
            id: String(item?.id || ""),
            at: Number(item?.at || 0) || 0,
            schoolId: String(item?.schoolId || "").trim().toLowerCase(),
            petId: String(item?.targetId || "").trim(),
            actorEmail: String(item?.actorEmail || "").trim().toLowerCase(),
            actorRole: String(item?.actorRole || "").trim(),
            health: metadata?.health !== undefined ? Number(metadata.health) : null,
            happiness: metadata?.happiness !== undefined ? Number(metadata.happiness) : null,
            energy: metadata?.energy !== undefined ? Number(metadata.energy) : null,
            hunger: metadata?.hunger !== undefined ? Number(metadata.hunger) : null,
            type: String(item?.type || "").trim(),
          };
        })
        .filter((item) => item.type === "VIRTUAL_PET_REVIVE")
        .filter((item) => !scopedSchoolId || item.schoolId === scopedSchoolId)
        .sort((a, b) => b.at - a.at)
        .slice(0, 12)
        .map(({ type, ...rest }) => rest);

      setReviveHistory(rows);
    });

    return () => unsub();
  }, [user]);

  // ADMIN VIEW
  if (user?.role === "admin" || user?.role === "super_admin") {
    // Stats Calculation
    const stats = useMemo(() => {
        const activePets = scopedPets.filter(p => p.stats.health > 0);
        const totalPets = activePets.length;
        const avgLevel = totalPets > 0 
            ? (activePets.reduce((acc, curr) => acc + (curr.stats.level || 1), 0) / totalPets).toFixed(1) 
            : "0";
        
        const atRisk = scopedPets.filter((pet) => {
            const risk = analyzePetRisk(pet);
            return risk.isDead || risk.isSick || risk.isSad || risk.isStarving || risk.isLowStatus;
        }).length;

        return { totalPets, avgLevel, atRisk };
    }, [scopedPets]);

    // Reward States
    const [rewardTarget, setRewardTarget] = useState<'all' | 'class' | 'student'>('all');
    const [selectedClassReward, setSelectedClassReward] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [studentSearchTerm, setStudentSearchTerm] = useState('');
    const [rewardType, setRewardType] = useState<'coins' | 'exp' | 'intelligence' | 'social'>('coins');
    const [rewardAmount, setRewardAmount] = useState(10);
    const [isSubmittingReward, setIsSubmittingReward] = useState(false);

    // Derived Data for Tabs
    const uniqueClasses = useMemo(() => {
        return Array.from(new Set(classes
            .map((item) => String(item.name || "").trim())
            .filter(Boolean)));
    }, [classes]);

    const topClasses = useMemo(() => {
        const classMap = new Map<string, { totalLevel: number, count: number }>();
        scopedPets.forEach(p => {
            const student = studentByIdentity.get(normalizeIdentity(p.studentId));
            const className = student?.class || 'Unknown';
            if (className === 'Unknown') return;
            
            if (!classMap.has(className)) {
                classMap.set(className, { totalLevel: 0, count: 0 });
            }
            const entry = classMap.get(className)!;
            entry.totalLevel += (p.stats.level || 1);
            entry.count += 1;
        });

        return Array.from(classMap.entries())
            .map(([className, data]) => ({
                className,
                avgLevel: parseFloat((data.totalLevel / data.count).toFixed(1))
            }))
            .sort((a, b) => b.avgLevel - a.avgLevel)
            .slice(0, 5);
    }, [scopedPets, studentByIdentity]);

    const leaderboardData = useMemo(() => {
        return scopedPets
            .map(p => {
                 const student = studentByIdentity.get(normalizeIdentity(p.studentId));
                 return {
                     ...p,
                     studentName: student?.name || 'Unknown',
                     className: student?.class || '-'
                 };
            })
            .sort((a, b) => {
                const levelDiff = (b.stats.level || 1) - (a.stats.level || 1);
                if (levelDiff !== 0) return levelDiff;
                return (b.stats.exp || 0) - (a.stats.exp || 0);
            });
    }, [scopedPets, studentByIdentity]);

    const handleGiveReward = async () => {
        if (rewardAmount <= 0) return;
        setIsSubmittingReward(true);
        try {
            let targetPetIds: string[] = [];
            
            if (rewardTarget === 'all') {
                targetPetIds = scopedPets.map(p => p.id);
            } else if (rewardTarget === 'class') {
                if (!selectedClassReward) {
                    alert('Pilih kelas terlebih dahulu');
                    setIsSubmittingReward(false);
                    return;
                }
                const classStudents = students.filter(s => s.class === selectedClassReward);
                const classStudentIdentities = new Set(
                    classStudents.flatMap((student) => getStudentIdentityCandidates(student))
                );
                
                targetPetIds = scopedPets.filter(p => 
                    classStudentIdentities.has(normalizeIdentity(p.studentId))
                ).map(p => p.id);
            } else if (rewardTarget === 'student') {
                if (!selectedStudentId) {
                    alert('Pilih siswa terlebih dahulu');
                    setIsSubmittingReward(false);
                    return;
                }
                const selectedStudent = studentByIdentity.get(normalizeIdentity(selectedStudentId));
                const selectedStudentIdentities = new Set(getStudentIdentityCandidates(selectedStudent));
                targetPetIds = scopedPets
                    .filter((pet) => selectedStudentIdentities.has(normalizeIdentity(pet.studentId)))
                    .map((pet) => pet.id);
            }

            if (targetPetIds.length > 0) {
                await giveReward(targetPetIds, rewardType, rewardAmount);
                alert(`Berhasil mengirim reward ke ${targetPetIds.length} pets!`);
            } else {
                alert('Tidak ada pet yang ditemukan untuk target ini.');
            }
        } catch (err) {
            console.error(err);
            alert('Gagal mengirim reward');
        } finally {
            setIsSubmittingReward(false);
        }
    };

    // Filtered Pets for Table (Students at Risk)
    const riskPets = useMemo(() => {
        const mappedPets = scopedPets.map((p) => {
            const student = studentByIdentity.get(normalizeIdentity(p.studentId));
            const risk = analyzePetRisk(p);

            return {
                ...p,
                studentName: student?.name || p.studentName || p.petName || 'Unknown Student',
                studentClass: student?.class || '-',
                risk,
            };
        });

        return mappedPets.filter((p) =>
            p.risk.isDead || p.risk.isSick || p.risk.isSad || p.risk.isStarving || p.risk.isLowStatus
        ).filter((p) =>
            p.studentName.toLowerCase().includes(searchTerm.toLowerCase()) || 
            p.petName.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [scopedPets, searchTerm, studentByIdentity]);

    const reviveHistoryRows = useMemo(() => {
        return reviveHistory.map((item) => {
            const pet = scopedPets.find((entry) => entry.id === item.petId);
            const student = pet ? studentByIdentity.get(normalizeIdentity(pet.studentId)) : undefined;
            return {
                ...item,
                studentName: student?.name || pet?.petName || 'Siswa tidak ditemukan',
                studentClass: student?.class || '-',
                petName: pet?.petName || 'Buddy',
            };
        });
    }, [reviveHistory, scopedPets, studentByIdentity]);

    return (
        <div className="min-h-screen bg-slate-900/30 p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                    <Activity className="w-6 h-6 text-blue-600" />
                    Monitoring Virtual Pet
                </h1>
                <p className="text-slate-400 text-sm mt-1">
                    Pantau kesehatan mental siswa, statistik, dan manajemen reward.
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-effect-dark-card p-6 rounded-xl shadow-sm border border-slate-700 flex justify-between items-center">
                    <div>
                        <p className="text-slate-400 text-sm font-medium">Total Pets Aktif</p>
                        <h2 className="text-3xl font-bold text-slate-100 mt-2">{stats.totalPets}</h2>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-full text-blue-600">
                        <Zap className="w-6 h-6" />
                    </div>
                </div>
                <div className="glass-effect-dark-card p-6 rounded-xl shadow-sm border border-slate-700 flex justify-between items-center">
                    <div>
                        <p className="text-slate-400 text-sm font-medium">Rata-rata Level</p>
                        <h2 className="text-3xl font-bold text-slate-100 mt-2">{stats.avgLevel}</h2>
                    </div>
                    <div className="p-3 bg-green-50 rounded-full text-green-600">
                        <Trophy className="w-6 h-6" />
                    </div>
                </div>
                <div className="glass-effect-dark-card p-6 rounded-xl shadow-sm border border-slate-700 flex justify-between items-center">
                    <div>
                        <p className="text-slate-400 text-sm font-medium">Perlu Perhatian</p>
                        <h2 className="text-3xl font-bold text-red-600 mt-2">{stats.atRisk}</h2>
                    </div>
                    <div className="p-3 bg-red-50 rounded-full text-red-600">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="glass-effect-dark-card rounded-xl shadow-sm border border-slate-700 overflow-hidden">
                {/* Tabs */}
                <div className="border-b border-slate-700 px-6 pt-4 flex gap-8 overflow-x-auto">
                    {[
                        { id: 'summary', label: 'Ringkasan', icon: LayoutDashboard },
                        { id: 'leaderboard', label: 'Global Leaderboard', icon: Trophy },
                        { id: 'risk', label: 'Students at Risk', icon: AlertTriangle, count: stats.atRisk },
                        { id: 'stats', label: 'Statistik', icon: PieChart },
                        { id: 'rewards', label: 'Admin Reward', icon: Gift },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`pb-4 text-sm font-medium flex items-center gap-2 transition-colors relative ${
                                activeTab === tab.id 
                                ? 'text-red-500 border-b-2 border-red-500' 
                                : 'text-slate-400 hover:text-slate-300'
                            }`}
                        >
                            {tab.label}
                            {tab.count !== undefined && tab.count > 0 && (
                                <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="p-6">
                    {activeTab === 'risk' && (
                        <div className="space-y-6">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input 
                                    type="text"
                                    placeholder="Cari siswa atau nama pet..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-900/30 border-y border-slate-700">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-red-600 uppercase tracking-wider">Siswa</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-red-600 uppercase tracking-wider">Pet</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-red-600 uppercase tracking-wider">Masalah</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-red-600 uppercase tracking-wider">Status Detail</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-red-600 uppercase tracking-wider">Keterangan</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-red-600 uppercase tracking-wider">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {riskPets.length > 0 ? (
                                            riskPets.map(pet => (
                                                <tr key={pet.id} className="hover:bg-slate-900/30 transition-colors">
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <div className="text-sm font-bold text-slate-100">{pet.studentName}</div>
                                                        <div className="text-xs font-semibold text-slate-400">{pet.studentClass}</div>
                                                    </td>
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-bold text-slate-100 uppercase">{pet.petName}</div>
                                                    <div className="text-xs font-semibold text-slate-400">Lvl {pet.stats.level}</div>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                <div className="space-y-1">
                                                    {pet.risk.isDead ? (
                                                        <div className="inline-flex items-center px-2 py-1 rounded bg-black text-white text-xs font-bold w-full shadow-sm">
                                                            💀 MATI / DEAD
                                                        </div>
                                                    ) : (
                                                        <>
                                                            {pet.risk.problems.map((problem) => (
                                                                <div key={`${pet.id}-${problem}`} className="inline-flex items-center px-2 py-1 rounded bg-red-100 text-red-800 text-xs font-bold w-full">
                                                                    {problem}
                                                                </div>
                                                            ))}
                                                </>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 align-middle">
                                                <div className="w-48 space-y-2">
                                                    <div className="flex items-center text-xs font-medium text-slate-300 gap-2">
                                                        <span className="w-12">Health</span>
                                                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                            <div 
                                                                className={`h-full rounded-full ${pet.stats.health <= 0 ? 'bg-black' : 'bg-red-600'}`}
                                                                style={{ width: `${Math.max(0, pet.stats.health)}%` }}
                                                            />
                                                        </div>
                                                        <span className="w-8 text-right font-bold">{Math.max(0, pet.stats.health)}%</span>
                                                    </div>
                                                    <div className="flex items-center text-xs font-medium text-slate-300 gap-2">
                                                        <span className="w-12">Happy</span>
                                                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                            <div 
                                                                className="h-full rounded-full bg-pink-500"
                                                                style={{ width: `${Math.max(0, pet.stats.happiness)}%` }}
                                                            />
                                                        </div>
                                                        <span className="w-8 text-right font-bold">{Math.max(0, pet.stats.happiness)}%</span>
                                                    </div>
                                                    <div className="flex items-center text-xs font-medium text-slate-300 gap-2">
                                                        <span className="w-12">Lapar</span>
                                                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                            <div 
                                                                className="h-full rounded-full bg-orange-500"
                                                                style={{ width: `${Math.max(0, pet.stats.hunger || 0)}%` }}
                                                            />
                                                        </div>
                                                        <span className="w-8 text-right font-bold">{Math.max(0, pet.stats.hunger || 0)}%</span>
                                                    </div>
                                                    <div className="text-[11px] font-semibold text-slate-400 text-right">
                                                        Rata-rata status: {pet.risk.avgStatus.toFixed(0)}%
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 align-middle">
                                                {(() => {
                                                    const condition = derivePetCondition(pet, pet.risk);
                                                    return (
                                                        <div className="space-y-1">
                                                            <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${condition.className}`}>
                                                                {condition.label}
                                                            </div>
                                                            {condition.sublabel ? (
                                                                <div className="text-[11px] font-semibold text-slate-400">
                                                                    {condition.sublabel}
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-400">
                                        {pet.risk.isDead ? (
                                            <button
                                                onClick={async () => {
                                                    if(confirm(`Hidupkan kembali pet milik ${pet.studentName}? Status akan di-reset ke 50%.`)) {
                                                        await revivePet(pet.id);
                                                    }
                                                }}
                                                className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors shadow-sm flex items-center gap-1"
                                            >
                                                <Zap className="w-3 h-3" />
                                                Hidupkan
                                            </button>
                                        ) : pet.risk.isLowStatus ? (
                                            <button
                                                onClick={async () => {
                                                    if(confirm(`Reset Level pet milik ${pet.studentName}? Level akan kembali ke 1 dan XP ke 0.`)) {
                                                        await resetPetLevel(pet.id);
                                                    }
                                                }}
                                                className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-xs font-bold hover:bg-yellow-600 transition-colors shadow-sm flex items-center gap-1"
                                            >
                                                <RotateCcw className="w-3 h-3" />
                                                Reset Lvl
                                            </button>
                                        ) : (
                                            <span className="text-gray-400">-</span>
                                        )}
                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-medium text-sm">
                                                    Tidak ada pet yang memerlukan perhatian khusus saat ini.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'summary' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Top Classes */}
                                <div className="bg-slate-900/30 rounded-xl p-6 border border-slate-700">
                                    <h3 className="font-bold text-slate-100 mb-4 flex items-center gap-2">
                                        <Trophy className="w-5 h-5 text-yellow-500" />
                                        Kelas Terbaik (Rata-rata Level)
                                    </h3>
                                    <div className="space-y-4">
                                        {topClasses.map((cls, idx) => (
                                            <div key={cls.className} className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                                        idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                                                        idx === 1 ? 'bg-gray-200 text-slate-300' :
                                                        idx === 2 ? 'bg-orange-100 text-orange-800' : 'bg-slate-800/50 text-slate-400'
                                                    }`}>
                                                        {idx + 1}
                                                    </div>
                                                    <span className="font-medium text-slate-300">{cls.className}</span>
                                                </div>
                                                <span className="font-bold text-slate-100">Lvl {cls.avgLevel}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Top Students */}
                                <div className="bg-slate-900/30 rounded-xl p-6 border border-slate-700">
                                    <h3 className="font-bold text-slate-100 mb-4 flex items-center gap-2">
                                        <Zap className="w-5 h-5 text-blue-500" />
                                        Siswa Top (Highest Level)
                                    </h3>
                                    <div className="space-y-4">
                                        {leaderboardData.slice(0, 5).map((pet, idx) => (
                                            <div key={pet.id} className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                                        idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                                                        idx === 1 ? 'bg-gray-200 text-slate-300' :
                                                        idx === 2 ? 'bg-orange-100 text-orange-800' : 'bg-slate-800/50 text-slate-400'
                                                    }`}>
                                                        {idx + 1}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-gray-800">{pet.studentName}</div>
                                                        <div className="text-xs font-semibold text-slate-400">{pet.className}</div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-bold text-slate-100">Lvl {pet.stats.level}</div>
                                                    <div className="text-xs font-semibold text-slate-400">{pet.stats.exp} XP</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-900/30 rounded-xl p-6 border border-slate-700">
                                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                                    <div>
                                        <h3 className="font-bold text-slate-100 flex items-center gap-2">
                                            <History className="w-5 h-5 text-red-500" />
                                            Riwayat Revive Pet
                                        </h3>
                                        <p className="text-xs font-semibold text-slate-400 mt-1">
                                            Menampilkan revive terbaru yang dilakukan admin untuk sekolah ini.
                                        </p>
                                    </div>
                                    <div className="text-xs font-bold text-slate-400">
                                        {reviveHistoryRows.length} data terbaru
                                    </div>
                                </div>

                                {reviveHistoryRows.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-slate-900/40 border-y border-slate-700">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Waktu</th>
                                                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Siswa</th>
                                                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Pet</th>
                                                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Admin</th>
                                                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Reset Stat</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800">
                                                {reviveHistoryRows.map((item) => (
                                                    <tr key={item.id} className="hover:bg-slate-900/30 transition-colors">
                                                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-slate-300">
                                                            {item.at ? new Date(item.at).toLocaleString('id-ID') : '-'}
                                                        </td>
                                                        <td className="px-4 py-4 whitespace-nowrap">
                                                            <div className="font-bold text-slate-100">{item.studentName}</div>
                                                            <div className="text-xs font-semibold text-slate-400">{item.studentClass}</div>
                                                        </td>
                                                        <td className="px-4 py-4 whitespace-nowrap">
                                                            <div className="font-bold text-slate-100 uppercase">{item.petName}</div>
                                                            <div className="text-xs font-semibold text-slate-400">{item.petId}</div>
                                                        </td>
                                                        <td className="px-4 py-4 whitespace-nowrap">
                                                            <div className="font-medium text-slate-300">{item.actorEmail || '-'}</div>
                                                            <div className="text-xs font-semibold text-slate-400">{item.actorRole || '-'}</div>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <div className="inline-flex flex-wrap gap-2 text-xs font-bold">
                                                                <span className="rounded-full bg-red-500/15 px-2 py-1 text-red-300">H {item.health ?? '-'}</span>
                                                                <span className="rounded-full bg-pink-500/15 px-2 py-1 text-pink-300">Happy {item.happiness ?? '-'}</span>
                                                                <span className="rounded-full bg-yellow-500/15 px-2 py-1 text-yellow-300">Energy {item.energy ?? '-'}</span>
                                                                <span className="rounded-full bg-orange-500/15 px-2 py-1 text-orange-300">Hunger {item.hunger ?? '-'}</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/20 px-4 py-8 text-center text-sm font-medium text-slate-400">
                                        Belum ada riwayat revive pet untuk sekolah ini.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'leaderboard' && (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-900/30 border-y border-slate-700">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Rank</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Siswa</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Kelas</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Pet</th>
                                        <th className="px-4 py-3 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Level & EXP</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {leaderboardData.map((pet, idx) => (
                                        <tr key={pet.id} className="hover:bg-slate-900/30 transition-colors">
                                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-slate-300">
                                                #{idx + 1}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap font-bold text-slate-100">
                                                {pet.studentName}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-slate-300">
                                                {pet.className}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-300">
                                                {pet.petName || 'Buddy'}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-right">
                                                <div className="text-sm font-bold text-slate-100">Lvl {pet.stats.level}</div>
                                                <div className="text-xs font-semibold text-slate-400">{pet.stats.exp} XP</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'stats' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {['health', 'happiness', 'energy'].map(stat => {
                                const data = scopedPets.map(p => (p.stats as any)[stat] || 0);
                                const high = data.filter(v => v >= 70).length;
                                const med = data.filter(v => v >= 30 && v < 70).length;
                                const low = data.filter(v => v < 30).length;
                                const total = data.length || 1;

                                return (
                                    <div key={stat} className="glass-effect-dark-card p-6 rounded-xl border border-slate-700 shadow-sm">
                                        <h3 className="capitalize font-bold text-slate-100 mb-4">{stat} Distribution</h3>
                                        <div className="space-y-3">
                                            <div>
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="text-green-600 font-medium">High (70-100)</span>
                                                    <span className="text-slate-400">{Math.round(high/total*100)}%</span>
                                                </div>
                                                <div className="w-full bg-slate-800/50 rounded-full h-2">
                                                    <div className="bg-green-500 h-2 rounded-full" style={{ width: `${high/total*100}%` }}></div>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="text-yellow-600 font-medium">Medium (30-69)</span>
                                                    <span className="text-slate-400">{Math.round(med/total*100)}%</span>
                                                </div>
                                                <div className="w-full bg-slate-800/50 rounded-full h-2">
                                                    <div className="bg-yellow-500 h-2 rounded-full" style={{ width: `${med/total*100}%` }}></div>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="text-red-600 font-medium">Low (0-29)</span>
                                                    <span className="text-slate-400">{Math.round(low/total*100)}%</span>
                                                </div>
                                                <div className="w-full bg-slate-800/50 rounded-full h-2">
                                                    <div className="bg-red-500 h-2 rounded-full" style={{ width: `${low/total*100}%` }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {activeTab === 'rewards' && (
                        <div className="max-w-2xl mx-auto space-y-8 py-4">
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-blue-900 text-sm flex gap-3 items-start">
                                <Gift className="w-5 h-5 flex-shrink-0 text-blue-600 mt-0.5" />
                                <p><strong>Info:</strong> Reward akan dikirimkan secara langsung ke device siswa. Gunakan fitur ini untuk memberikan apresiasi massal atau bantuan darurat.</p>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-sm font-bold text-slate-100">Target Penerima</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        onClick={() => setRewardTarget('all')}
                                        className={`px-3 py-2 rounded-lg border text-xs sm:text-sm font-medium flex items-center justify-center gap-1 transition-all ${
                                            rewardTarget === 'all'
                                            ? 'border-blue-600 bg-blue-50 text-blue-900'
                                            : 'border-gray-300 glass-effect-dark-card hover:border-gray-400 text-slate-100'
                                        }`}
                                    >
                                        <School className={`w-4 h-4 ${rewardTarget === 'all' ? 'text-blue-700' : 'text-slate-400'}`} />
                                        <span>Semua</span>
                                    </button>
                                    <button
                                        onClick={() => setRewardTarget('class')}
                                        className={`px-3 py-2 rounded-lg border text-xs sm:text-sm font-medium flex items-center justify-center gap-1 transition-all ${
                                            rewardTarget === 'class'
                                            ? 'border-blue-600 bg-blue-50 text-blue-900'
                                            : 'border-gray-300 glass-effect-dark-card hover:border-gray-400 text-slate-100'
                                        }`}
                                    >
                                        <Users className={`w-4 h-4 ${rewardTarget === 'class' ? 'text-blue-700' : 'text-slate-400'}`} />
                                        <span>Per Kelas</span>
                                    </button>
                                    <button
                                        onClick={() => setRewardTarget('student')}
                                        className={`px-3 py-2 rounded-lg border text-xs sm:text-sm font-medium flex items-center justify-center gap-1 transition-all ${
                                            rewardTarget === 'student'
                                            ? 'border-blue-600 bg-blue-50 text-blue-900'
                                            : 'border-gray-300 glass-effect-dark-card hover:border-gray-400 text-slate-100'
                                        }`}
                                    >
                                        <User className={`w-4 h-4 ${rewardTarget === 'student' ? 'text-blue-700' : 'text-slate-400'}`} />
                                        <span>Siswa</span>
                                    </button>
                                </div>
                            </div>

                            {rewardTarget === 'class' && (
                                <div className="space-y-2">
                                    <label className="block text-sm font-bold text-slate-100">Pilih Kelas</label>
                                    <select
                                        value={selectedClassReward}
                                        onChange={(e) => setSelectedClassReward(e.target.value)}
                                        className="w-full p-3 border border-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 glass-effect-dark-card text-slate-100 font-medium"
                                    >
                                        <option value="">-- Pilih Kelas --</option>
                                        {uniqueClasses.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {rewardTarget === 'student' && (
                                <div className="space-y-2">
                                    <label className="block text-sm font-bold text-slate-100">Cari Siswa</label>
                                    <input
                                        type="text"
                                        placeholder="Ketik nama siswa..."
                                        value={studentSearchTerm}
                                        onChange={(e) => setStudentSearchTerm(e.target.value)}
                                        className="w-full p-3 border border-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 mb-2 glass-effect-dark-card text-slate-100 font-medium placeholder-gray-600"
                                    />
                                    {studentSearchTerm.length > 1 && !selectedStudentId && (
                                        <div className="border border-gray-300 rounded-xl max-h-48 overflow-y-auto glass-effect-dark-card shadow-lg">
                                            {students
                                                .filter(s => s.name.toLowerCase().includes(studentSearchTerm.toLowerCase()))
                                                .slice(0, 5)
                                                .map(s => (
                                                    <button
                                                        key={s.id}
                                                        onClick={() => {
                                                            setSelectedStudentId(s.id);
                                                            setStudentSearchTerm(s.name);
                                                        }}
                                                        className="w-full text-left px-4 py-3 hover:bg-slate-800/50 border-b border-slate-700 last:border-0"
                                                    >
                                                        <div className="font-bold text-sm text-slate-100">{s.name}</div>
                                                        <div className="text-xs font-semibold text-slate-400">{s.class} | {s.nisn}</div>
                                                    </button>
                                                ))}
                                        </div>
                                    )}
                                    {selectedStudentId && (
                                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl text-blue-900 border border-blue-200 shadow-sm">
                                            <span className="font-bold">Siswa Terpilih: {studentByIdentity.get(normalizeIdentity(selectedStudentId))?.name}</span>
                                            <button 
                                                onClick={() => {
                                                    setSelectedStudentId('');
                                                    setStudentSearchTerm('');
                                                }}
                                                className="text-xs underline hover:text-blue-900 font-bold"
                                            >
                                                Ganti
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="space-y-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="block text-sm font-bold text-slate-100">Jenis Reward</label>
                                        <select
                                            value={rewardType}
                                            onChange={(e) => setRewardType(e.target.value as any)}
                                            className="w-full p-3 border border-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 glass-effect-dark-card text-slate-100 font-medium"
                                        >
                                            <optgroup label="Resources" className="font-bold text-slate-100">
                                                <option value="coins">Coins (Mata Uang)</option>
                                                <option value="exp">XP (Experience Points)</option>
                                            </optgroup>
                                            <optgroup label="Non-Core Stats" className="font-bold text-slate-100">
                                                <option value="intelligence">Kecerdasan (+Intelligence)</option>
                                                <option value="social">Sosial (+Social)</option>
                                            </optgroup>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="block text-sm font-bold text-slate-100">Jumlah</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="1000"
                                            value={rewardAmount}
                                            onChange={(e) => setRewardAmount(parseInt(e.target.value) || 0)}
                                            className="w-full p-3 border border-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 glass-effect-dark-card text-slate-100 font-bold"
                                        />
                                    </div>
                                </div>
                                <p className="text-sm font-medium text-slate-300">
                                    {rewardType === 'coins' || rewardType === 'exp'
                                      ? 'Masukkan jumlah koin/XP.'
                                      : 'Reward manual hanya berlaku untuk stat non-inti seperti kecerdasan dan sosial.'}
                                </p>
                            </div>

                            <button
                                onClick={handleGiveReward}
                                disabled={isSubmittingReward}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmittingReward ? 'Mengirim...' : 'Kirim Reward Sekarang'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
  }

  // STUDENT VIEW
  if (user?.role === 'student') {
    const myPet = pets.find((pet) => {
      const petStudentId = normalizeIdentity(pet.studentId);
      return [normalizeIdentity(user.id), normalizeIdentity(user.nisn)]
        .filter(Boolean)
        .includes(petStudentId);
    });

    return (
      <div className="min-h-screen bg-slate-900/30 p-6">
         <div className="max-w-md mx-auto glass-effect-dark-card rounded-2xl shadow-sm border border-slate-700 overflow-hidden">
            <div className="bg-orange-100 p-6 text-center">
               <div className="w-32 h-32 mx-auto glass-effect-dark-card rounded-full flex items-center justify-center shadow-inner mb-4 text-6xl">
                  {myPet?.stats.health && myPet.stats.health > 0 ? '🐱' : '💀'}
               </div>
               <h1 className="text-2xl font-bold text-slate-100">{myPet?.petName || 'Pet Saya'}</h1>
               <div className="flex justify-center gap-2 mt-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                     !myPet ? 'bg-slate-800/50 text-slate-400' :
                     myPet.stats.health <= 0 ? 'bg-red-100 text-red-800' :
                     myPet.stats.health < 30 ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {!myPet ? 'Belum Menetas' : myPet.stats.health <= 0 ? 'Mati' : myPet.stats.health < 30 ? 'Sakit' : 'Sehat'}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                    Level {myPet?.stats.level || 1}
                  </span>
               </div>
            </div>

            <div className="p-6 space-y-6">
               {/* Stats Bars */}
               {myPet ? (
                 <>
                   <div className="space-y-1">
                      <div className="flex justify-between text-sm font-medium">
                         <span className="text-slate-400">Kesehatan</span>
                         <span className="text-slate-100">{myPet.stats.health}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                         <div className="bg-red-500 h-2.5 rounded-full" style={{ width: `${myPet.stats.health}%` }}></div>
                      </div>
                   </div>

                   <div className="space-y-1">
                      <div className="flex justify-between text-sm font-medium">
                         <span className="text-slate-400">Kenyang</span>
                         <span className="text-slate-100">{100 - (myPet.stats.hunger || 0)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                         <div className="bg-orange-500 h-2.5 rounded-full" style={{ width: `${100 - (myPet.stats.hunger || 0)}%` }}></div>
                      </div>
                   </div>

                   <div className="space-y-1">
                      <div className="flex justify-between text-sm font-medium">
                         <span className="text-slate-400">Kebahagiaan</span>
                         <span className="text-slate-100">{myPet.stats.happiness}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                         <div className="bg-yellow-400 h-2.5 rounded-full" style={{ width: `${myPet.stats.happiness}%` }}></div>
                      </div>
                   </div>

                   <div className="space-y-1">
                      <div className="flex justify-between text-sm font-medium">
                         <span className="text-slate-400">Energi</span>
                         <span className="text-slate-100">{myPet.stats.energy}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                         <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${myPet.stats.energy}%` }}></div>
                      </div>
                   </div>
                 </>
               ) : (
                 <div className="text-center text-slate-400 py-4">
                    Anda belum memiliki Virtual Pet.
                 </div>
               )}

               {myPet && myPet.stats.health > 0 && (
                   <div className="space-y-4 pt-4 border-t border-slate-700">
                      <div className="rounded-xl border border-blue-500/30 bg-blue-900/20 p-4 text-sm text-blue-100">
                        Status Virtual Pet di web hanya untuk pemantauan. Perubahan stat mengikuti aktivitas asli siswa di aplikasi:
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-xl border border-orange-500/30 bg-orange-900/20 p-3">
                          <div className="mb-2 flex items-center gap-2 text-orange-200">
                            <Utensils className="w-5 h-5" />
                            <span className="font-bold">Kenyang</span>
                          </div>
                          <p className="text-xs text-slate-300">Naik saat siswa rajin membaca di E-Library.</p>
                        </div>
                        <div className="rounded-xl border border-yellow-500/30 bg-yellow-900/20 p-3">
                          <div className="mb-2 flex items-center gap-2 text-yellow-200">
                            <Gamepad2 className="w-5 h-5" />
                            <span className="font-bold">Kebahagiaan</span>
                          </div>
                          <p className="text-xs text-slate-300">Mengikuti kedisiplinan presensi dan check-out sekolah.</p>
                        </div>
                        <div className="rounded-xl border border-blue-500/30 bg-blue-900/20 p-3">
                          <div className="mb-2 flex items-center gap-2 text-blue-200">
                            <Moon className="w-5 h-5" />
                            <span className="font-bold">Energi</span>
                          </div>
                          <p className="text-xs text-slate-300">Naik saat siswa menjalankan 7 KAIH pada hari berjalan.</p>
                        </div>
                        <div className="rounded-xl border border-red-500/30 bg-red-900/20 p-3">
                          <div className="mb-2 flex items-center gap-2 text-red-200">
                            <Activity className="w-5 h-5" />
                            <span className="font-bold">Kesehatan</span>
                          </div>
                          <p className="text-xs text-slate-300">Naik saat siswa rutin mengumpulkan tugas atau laporan literasi.</p>
                        </div>
                      </div>
                   </div>
               )}
            </div>
         </div>
      </div>
    );
  }

  // Determine Class Name
  const className = useMemo(() => {
    if (user?.role === 'teacher') {
      const me = teachers.find(t => t.nuptk === user.id);
      return me?.homeroomClass || null;
    }
    if (user?.role === 'student') {
      const me = studentByIdentity.get(normalizeIdentity(user.id))
        || studentByIdentity.get(normalizeIdentity(user.nisn));
      return me?.class || null;
    }
    return null;
  }, [user, teachers, studentByIdentity]);

  // Filter Students by Class
  const classStudents = useMemo(() => {
    if (!className) return [];
    return students.filter(s => (s.class || "").toUpperCase() === className.toUpperCase());
  }, [students, className]);

  // Filter by Search
  const filteredStudents = useMemo(() => {
    return classStudents.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.nisn.includes(searchTerm)
    );
  }, [classStudents, searchTerm]);

  // Get Pet Status helper
  const getPetStatus = (studentId: string, studentNisn: string) => {
    const identityCandidates = [normalizeIdentity(studentId), normalizeIdentity(studentNisn)].filter(Boolean);
    const pet = pets.find((item) => identityCandidates.includes(normalizeIdentity(item.studentId)));
    if (!pet) return { status: 'Belum ada Pet', color: 'text-slate-400', bg: 'bg-slate-800/50', icon: null };
    
    if (pet.stats.health <= 0) return { status: 'Pet Mati', color: 'text-red-600', bg: 'bg-red-50', icon: '💀' };
    if (pet.stats.health < 30) return { status: 'Pet Sakit', color: 'text-orange-600', bg: 'bg-orange-50', icon: '🤒' };
    
    return { status: 'Pet Sehat', color: 'text-green-600', bg: 'bg-green-50', icon: '🐱' };
  };

  return (
    <div className="min-h-screen bg-slate-900/30">
      {/* Header Blue Background */}
      <div className="bg-blue-600 px-6 pt-6 pb-12">
        <div className="flex items-center text-white mb-4">
          <button onClick={() => router.back()} className="mr-4">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Data Siswa</h1>
            <p className="text-sm text-blue-100">
              {className ? `Wali Kelas ${className}` : 'Anda belum memiliki kelas ampu'}
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 -mt-8">
        {/* Search Bar */}
        <div className="glass-effect-dark-card rounded-lg shadow-md p-2 mb-4 flex items-center">
          <Search className="w-5 h-5 text-gray-400 ml-2" />
          <input 
            type="text"
            placeholder="Cari nama, NISN, atau kelas..."
            className="w-full border-none focus:ring-0 text-sm p-2 text-slate-300 placeholder-gray-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Class Summary Card */}
        {className && (
          <div className="bg-blue-100 rounded-lg p-4 mb-4 border border-blue-200">
            <h2 className="text-lg font-bold text-blue-900">Kelas: {className}</h2>
            <p className="text-sm text-blue-700">Total Siswa: {classStudents.length}</p>
          </div>
        )}

        {/* Student List */}
        <div className="space-y-3 pb-8">
          {!className ? (
            <div className="text-center py-8 text-slate-400 text-sm glass-effect-dark-card rounded-lg shadow-sm p-8">
              <p className="font-semibold text-slate-300 mb-2">Belum Ada Kelas</p>
              <p>Akun Anda belum diatur sebagai Wali Kelas. Hubungi admin untuk pengaturan kelas.</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              Tidak ada siswa ditemukan.
            </div>
          ) : (
            filteredStudents.map((student) => {
            const petInfo = getPetStatus(student.id, student.nisn);
            
            return (
              <div key={student.id} className="glass-effect-dark-card rounded-lg shadow-sm p-4 border border-slate-700 flex items-center">
                {/* Avatar Circle */}
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg mr-4 shrink-0">
                  {student.name.charAt(0)}
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-slate-100 truncate">{student.name}</h3>
                  <p className="text-xs text-slate-400 mb-1">NISN: {student.nisn}</p>
                  
                  {/* Pet Status Chip */}
                  <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${petInfo.bg} ${petInfo.color}`}>
                    {petInfo.icon && <span className="mr-1">{petInfo.icon}</span>}
                    {petInfo.status}
                  </div>
                </div>
              </div>
            );
          }))}
        </div>
      </div>
    </div>
  );
}

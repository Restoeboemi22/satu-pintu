import { create } from 'zustand';
import { ref, onValue, update, push, set as firebaseSet } from 'firebase/database';
import { database } from '@/lib/firebase';

export type IncidentType = 'VERBAL' | 'PHYSICAL' | 'CYBER' | 'SOCIAL' | 'SEXUAL' | 'OTHER' | 'TAWURAN' | 'KECELAKAAN' | 'KEHILANGAN' | 'KERUSAKAN_FASILITAS' | 'LAINNYA';
export type ReportStatus = 'PENDING' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';
export type ReportPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface BullyingReport {
  id: string; // Changed to string for consistency with web, Android uses Long but we can map it
  reporterId?: string;
  reporterName?: string; // Derived/joined
  isAnonymous: boolean;
  victimId?: string;
  victimName?: string; // Derived/joined
  perpetratorId?: string;
  perpetratorName?: string; // Derived/joined
  incidentDate: number; // Timestamp
  incidentLocation?: string;
  incidentType: IncidentType;
  category: 'BULLYING' | 'INCIDENT'; // Added category
  description?: string;
  evidence?: string; // JSON
  status: ReportStatus;
  priority: ReportPriority;
  assignedTo?: string;
  resolutionNotes?: string;
  resolvedAt?: number;
  createdAt: number;
  updatedAt: number;
}

interface BullyingStore {
  reports: BullyingReport[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setReports: (reports: BullyingReport[]) => void;
  addReport: (report: BullyingReport) => Promise<void>;
  updateReportStatus: (id: string, status: ReportStatus, notes?: string) => Promise<void>;
  
  // Sync
  initBullyingSync: () => () => void;
  syncAndroidReports: (newReports: BullyingReport[]) => void;
}

// Initial Mock Data
const initialReports: BullyingReport[] = [];

export const useBullyingStore = create<BullyingStore>((set) => ({
  reports: initialReports,
  isLoading: false,
  error: null,

  setReports: (reports) => set({ reports }),
  
  addReport: async (report) => {
    try {
      const reportsRef = ref(database, 'bullying_reports');
      const newReportRef = push(reportsRef);
      await firebaseSet(newReportRef, { ...report, id: newReportRef.key });
    } catch (error) {
      console.error("Error adding bullying report:", error);
    }
  },
  
  updateReportStatus: async (id, status, notes) => {
    try {
      const reportRef = ref(database, `bullying_reports/${id}`);
      await update(reportRef, {
        status,
        resolutionNotes: notes,
        resolvedAt: status === 'RESOLVED' || status === 'CLOSED' ? Date.now() : null,
        updatedAt: Date.now()
      });
    } catch (error) {
      console.error("Error updating bullying report:", error);
    }
  },

  initBullyingSync: () => {
    const reportsRef = ref(database, 'bullying_reports');
    const unsubscribe = onValue(reportsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const reports: BullyingReport[] = Object.keys(data).map(key => ({
          ...data[key],
          id: key
        }));
        set({ reports: reports.sort((a, b) => b.createdAt - a.createdAt) });
      } else {
        set({ reports: [] });
      }
    });
    return unsubscribe;
  },

  syncAndroidReports: (newReports) => set((state) => {
    // Strict Sync: Replace local state with Firebase state
    // This ensures deletions and updates are perfectly mirrored
    return { reports: newReports.sort((a, b) => b.createdAt - a.createdAt) };
  })
}));

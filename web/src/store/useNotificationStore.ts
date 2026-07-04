import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { database } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { edulockAuth } from '@/lib/edulockFirebase';

export type NotificationTargetType = 'TEACHERS' | 'STUDENTS' | 'CLASS' | 'ALL_CLASSES' | 'SPECIFIC_STUDENT';

export interface Notification {
  id: string;
  title: string;
  message: string;
  targetType: NotificationTargetType;
  targetValue?: string; // Class Name, or Student ID
  targetName?: string; // Display name for the target (e.g. Student Name)
  sentAt: number;
  senderName: string;
  schoolId?: string;
  channel: 'teacher' | 'student';
}

interface NotificationState {
  notifications: Notification[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  sendNotification: (
    title: string, 
    message: string, 
    targetType: NotificationTargetType, 
    targetValue?: string,
    targetName?: string,
    senderName?: string,
    schoolId?: string
  ) => Promise<void>;
  
  deleteNotification: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  
  // Sync
  initNotificationSync: (schoolId?: string) => () => void;
}

const normalizeScope = (value?: string | null) => String(value || '').trim().toLowerCase();

const callNotificationAdminApi = async (
  method: "POST" | "DELETE",
  payload: Record<string, unknown>
) => {
  const currentUser = edulockAuth.currentUser;
  if (!currentUser) {
    throw new Error("Sesi admin tidak aktif. Silakan login ulang.");
  }

  const idToken = await currentUser.getIdToken();
  const response = await fetch("/api/admin/notifications", {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.success === false) {
    throw new Error(String(result?.message || "Permintaan backend notifikasi gagal diproses."));
  }

  return result;
};

const readNotifications = (
  data: Record<string, any> | null,
  fallbackTargetType: NotificationTargetType,
  channel: 'teacher' | 'student',
  scopedSchoolId: string
): Notification[] => {
  if (!data || typeof data !== 'object') return [];

  return Object.entries(data)
    .map(([key, value]) => {
      const targetType = (value?.targetType as NotificationTargetType | undefined) || fallbackTargetType;
      const recordSchoolId = normalizeScope(value?.schoolId);

      if (scopedSchoolId && recordSchoolId && recordSchoolId !== scopedSchoolId) {
        return null;
      }

      return {
        id: key,
        title: String(value?.title || 'Pengumuman'),
        message: String(value?.content || ''),
        targetType,
        targetValue: value?.targetValue || undefined,
        targetName: value?.targetName || undefined,
        sentAt: Number(value?.date || 0) || Date.now(),
        senderName: String(value?.sender || 'Admin'),
        schoolId: value?.schoolId || undefined,
        channel,
      } satisfies Notification;
    })
    .filter((item): item is Notification => Boolean(item) && Boolean(item?.message));
};

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      isLoading: false,
      error: null,

      sendNotification: async (title, message, targetType, targetValue, targetName, senderName = "Admin", schoolId) => {
        set({ isLoading: true, error: null });
        
        try {
          const normalizedSchoolId = normalizeScope(schoolId);
          const result = await callNotificationAdminApi("POST", {
            action: "create-notification",
            title,
            message,
            targetType,
            targetValue,
            targetName,
            senderName,
            schoolId: normalizedSchoolId || undefined,
          });
          const responseNotification = result?.data || {};
          const newNotification: Notification = {
            id: String(responseNotification.id || Date.now().toString()),
            title: String(responseNotification.title || title),
            message: String(responseNotification.message || message),
            targetType: (responseNotification.targetType as NotificationTargetType) || targetType,
            targetValue: responseNotification.targetValue || targetValue,
            targetName: responseNotification.targetName || targetName,
            sentAt: Number(responseNotification.sentAt || Date.now()),
            senderName: String(responseNotification.senderName || senderName),
            schoolId: responseNotification.schoolId || normalizedSchoolId || undefined,
            channel: responseNotification.channel === 'teacher' ? 'teacher' : 'student',
          };

          set(state => ({
            notifications: [newNotification, ...state.notifications],
            isLoading: false
          }));
        } catch (error) {
          console.error("Error sending notification:", error);
          set({ isLoading: false, error: String((error as any)?.message || 'Gagal mengirim notifikasi') });
          throw error;
        }
      },

      deleteNotification: async (id) => {
        const current = get().notifications.find((notification) => notification.id === id);
        if (!current) return;

        const nodePath = current.channel === 'teacher'
          ? 'system_announcements/teacher'
          : 'system_announcements/student';

        try {
          await callNotificationAdminApi("DELETE", {
            action: "delete-notification",
            id,
            channel: current.channel,
            schoolId: current.schoolId,
          });
          set((state) => ({
            notifications: state.notifications.filter((notification) => notification.id !== id)
          }));
        } catch (error) {
          console.error('Error deleting notification:', error);
          set({ error: String((error as any)?.message || 'Gagal menghapus notifikasi') });
          throw error;
        }
      },

      clearHistory: async () => {
        const notifications = [...get().notifications];

        try {
          await callNotificationAdminApi("DELETE", {
            action: "clear-history",
            schoolId: normalizeScope(notifications[0]?.schoolId),
            items: notifications.map((notification) => ({
              id: notification.id,
              channel: notification.channel,
            })),
          });
          set({ notifications: [] });
        } catch (error) {
          console.error('Error clearing notification history:', error);
          set({ error: String((error as any)?.message || 'Gagal menghapus riwayat notifikasi') });
          throw error;
        }
      },

      initNotificationSync: (schoolId) => {
        const teacherRef = ref(database, 'system_announcements/teacher');
        const studentRef = ref(database, 'system_announcements/student');

        const scopedSchoolId = normalizeScope(schoolId);
        let teacherNotifications: Notification[] = [];
        let studentNotifications: Notification[] = [];

        const syncCombinedNotifications = () => {
          set({
            notifications: [...teacherNotifications, ...studentNotifications]
              .sort((a, b) => b.sentAt - a.sentAt),
            isLoading: false,
          });
        };

        const handleSnapshot = (
          snapshot: any,
          fallbackTargetType: NotificationTargetType,
          channel: 'teacher' | 'student'
        ) => {
          const data = snapshot.val();
          const nextNotifications = readNotifications(data, fallbackTargetType, channel, scopedSchoolId);

          if (channel === 'teacher') {
            teacherNotifications = nextNotifications;
          } else {
            studentNotifications = nextNotifications;
          }

          syncCombinedNotifications();
        };

        set({ isLoading: true, error: null });

        const unsubTeacher = onValue(teacherRef, (snap) => handleSnapshot(snap, 'TEACHERS', 'teacher'));
        const unsubStudent = onValue(studentRef, (snap) => handleSnapshot(snap, 'STUDENTS', 'student'));

        return () => {
          unsubTeacher();
          unsubStudent();
        };
      }
    }),
    {
      name: 'notification-storage',
    }
  )
);

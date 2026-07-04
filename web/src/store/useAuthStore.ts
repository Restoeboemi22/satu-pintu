import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type PortalUserRole = 'super_admin' | 'admin' | 'teacher' | 'student';

export interface PortalUser {
  id: string;
  name: string;
  email: string;
  role: PortalUserRole;
  schoolId?: string;
  schoolName?: string;
  npsn?: string;
  class?: string;
  nisn?: string;
  nuptk?: string;
}

export type ActiveApp = 'gaspa' | 'edulock';

interface AuthState {
  user: PortalUser | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;
  activeApp: ActiveApp;
  login: (user: PortalUser) => void;
  logout: () => void;
  clearLocalAuth: () => void;
  updateUser: (patch: Partial<PortalUser>) => void;
  setActiveApp: (app: ActiveApp) => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      _hasHydrated: false,
      activeApp: 'gaspa',
      login: (user) => set({ user, isAuthenticated: true }),
      logout: () => {
        if (typeof window !== 'undefined') {
          void fetch('/api/portal/session', {
            method: 'DELETE',
            headers: {
              'X-Portal-Logout': '1',
            },
            credentials: 'include',
          }).catch(() => {});
        }
        set({ user: null, isAuthenticated: false, activeApp: 'gaspa' });
      },
      clearLocalAuth: () => set({ user: null, isAuthenticated: false, activeApp: 'gaspa' }),
      updateUser: (patch) =>
        set((state) => {
          if (!state.user) return state;
          return { user: { ...state.user, ...patch } };
        }),
      setActiveApp: (app) => set({ activeApp: app }),
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined') {
          return localStorage;
        }
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

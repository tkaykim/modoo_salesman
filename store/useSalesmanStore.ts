import { createClient } from '@/lib/supabase-client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type AuthStatus = 'idle' | 'hydrating' | 'checking' | 'authenticated' | 'unauthenticated';

export interface SalesmanData {
  id: string; // auth user id (auth.users.id, profiles.id)
  email: string;
  name?: string;
  phone?: string;
  // 'salesman'은 앱 컨텍스트 표시용. profiles.role 값과 별개.
  // (사용자는 admin/customer/factory 역할이면서 동시에 영업사원일 수 있음)
  role: 'salesman';
  grade?: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';
  salesman_code?: string;
  // salesman_profiles.id — partner_malls.salesman_id 등 FK 사용
  salesman_profile_id?: string;
  joined_at?: string;
}

interface AuthState {
  user: SalesmanData | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authStatus: AuthStatus;

  setAuthStatus: (status: AuthStatus) => void;
  setUser: (user: SalesmanData) => void;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<SalesmanData>) => void;
  setLoading: (loading: boolean) => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
}

export const useSalesmanStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      authStatus: 'idle' as AuthStatus,

      setAuthStatus: (status) => set({ authStatus: status }),

      setUser: (user) =>
        set({
          user,
          isAuthenticated: true,
          isLoading: false,
          authStatus: 'authenticated',
        }),

      logout: async () => {
        try {
          const supabase = createClient();
          await supabase.auth.signOut();
        } catch (e) {
          console.error('Error signing out:', e);
        }
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          authStatus: 'unauthenticated',
        });
      },

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      setLoading: (loading) => set({ isLoading: loading }),

      login: async (email, password) => {
        try {
          set({ isLoading: true });
          const supabase = createClient();
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });

          if (error) {
            set({ isLoading: false });
            return { success: false, error: error.message };
          }

          if (data.user) {
            set({ isLoading: false });
            return { success: true };
          }

          set({ isLoading: false });
          return { success: false, error: '로그인 실패' };
        } catch (err) {
          set({ isLoading: false });
          return { success: false, error: (err as Error).message };
        }
      },
    }),
    {
      name: 'salesman-auth-storage',
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
      skipHydration: true,
    }
  )
);

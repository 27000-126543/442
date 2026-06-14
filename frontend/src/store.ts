import { create } from 'zustand';
import type { User, Company, Department, GameEvent, EconomicIndicator } from '../types';

interface AppState {
  user: User | null;
  token: string | null;
  company: Company | null;
  departments: Department[];
  unreadCount: number;
  economy: EconomicIndicator | null;

  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setCompany: (company: Company | null) => void;
  setDepartments: (deps: Department[]) => void;
  setUnreadCount: (n: number) => void;
  setEconomy: (e: EconomicIndicator) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  token: null,
  company: null,
  departments: [],
  unreadCount: 0,
  economy: null,

  setUser: (user) => {
    set({ user });
    if (user) localStorage.setItem('user', JSON.stringify(user));
  },
  setToken: (token) => {
    set({ token });
    if (token) localStorage.setItem('token', token);
  },
  setCompany: (company) => set({ company }),
  setDepartments: (departments) => set({ departments }),
  setUnreadCount: (unreadCount) => set({ unreadCount }),
  setEconomy: (economy) => set({ economy }),

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null, company: null, departments: [] });
  },

  hydrate: () => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token) set({ token });
    if (userStr) {
      try {
        set({ user: JSON.parse(userStr) });
      } catch {
        /* ignore */
      }
    }
  },
}));

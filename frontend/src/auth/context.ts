import { createContext } from 'react';
import type { Me } from '../api';

export type AuthState = {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => void;
  setSession: (token: string, me: Me) => void;
};

export const AuthContext = createContext<AuthState | null>(null);

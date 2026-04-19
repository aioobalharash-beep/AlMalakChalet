import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../services/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'client';
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; phone?: string }) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('almalak_user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Verify user still exists in Firestore
        authApi.me(parsed.id)
          .then((userData) => {
            if (userData) {
              setUser(userData as User);
            } else {
              localStorage.removeItem('almalak_user');
            }
          })
          .catch(() => {
            localStorage.removeItem('almalak_user');
          })
          .finally(() => setIsLoading(false));
      } catch {
        localStorage.removeItem('almalak_user');
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    localStorage.setItem('almalak_user', JSON.stringify(result.user));
    setUser(result.user);
  }, []);

  const register = useCallback(async (data: { name: string; email: string; password: string; phone?: string }) => {
    const result = await authApi.register(data);
    localStorage.setItem('almalak_user', JSON.stringify(result.user));
    setUser(result.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('almalak_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      login,
      register,
      logout,
      isAdmin: user?.role === 'admin',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

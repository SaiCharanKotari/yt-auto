import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type UserPlan = 'free' | 'pro' | 'business';

export interface UserProfile {
  id: string;
  userId?: string;
  email: string;
  name: string;
  picture?: string;
  googleId?: string;
  emailVerified: boolean;
  plan: UserPlan;
  storageLimit: number;
  storageUsed: number;
  googleDriveConnected: boolean;
  hasGoogleDrive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isPro: boolean;
  hasDriveAccess: boolean;
  googleDriveConnected: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<void>;
  register: (
    email: string,
    password: string,
    name?: string,
    plan?: UserPlan
  ) => Promise<{ success: boolean; error?: string; message?: string }>;
  registerWithEmail: (
    email: string,
    password: string,
    name?: string
  ) => Promise<{ success: boolean; error?: string; message?: string }>;
  logout: () => Promise<void>;
  verifyEmail: (token: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  resendVerification: (email: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; message?: string; resetCode?: string; error?: string }>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; message?: string; resetCode?: string; error?: string }>;
  resetPassword: (
    tokenOrEmail: string,
    newPasswordOrCode: string,
    maybeNewPassword?: string
  ) => Promise<{ success: boolean; error?: string; message?: string }>;
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ success: boolean; message?: string; error?: string }>;
  selectPlan: (plan: UserPlan) => Promise<{ success: boolean; error?: string }>;
  connectGoogleDrive: () => Promise<void>;
  disconnectGoogleDrive: () => Promise<{ success: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
}

const BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string) ||
  (typeof window !== 'undefined' && window.location.port !== '5173'
    ? window.location.origin
    : 'http://localhost:3001');

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch current authenticated user info via HttpOnly session cookie
  const fetchCurrentUser = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
        credentials: 'include', // Automatically attaches HttpOnly session cookie
      });

      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser({
            ...data.user,
            userId: data.user.id,
            hasGoogleDrive: Boolean(data.user.googleDriveConnected),
          });
          return;
        }
      }
      setUser(null);
    } catch (err: any) {
      console.warn('[Auth] Session check failed:', err.message);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.error || 'Invalid email or password' };
      }

      if (data.user) {
        setUser({
          ...data.user,
          userId: data.user.id,
          hasGoogleDrive: Boolean(data.user.googleDriveConnected),
        });
        return { success: true };
      }

      return { success: false, error: 'Login succeeded but no user returned' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login request failed' };
    }
  };

  const register = async (
    email: string,
    password: string,
    name?: string,
    plan: UserPlan = 'free'
  ) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, name, plan }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.error || 'Registration failed' };
      }

      if (data.user) {
        setUser({
          ...data.user,
          userId: data.user.id,
          hasGoogleDrive: Boolean(data.user.googleDriveConnected),
        });
        return {
          success: true,
          message: data.message || 'Account created! Please check your email for verification.',
        };
      }

      return { success: false, error: 'Registration succeeded but no user profile returned' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Registration request failed' };
    }
  };

  const logout = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (_) {}
    setUser(null);
  };

  const verifyEmail = async (token: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.error || 'Verification failed' };
      }

      if (data.user) {
        setUser({
          ...data.user,
          userId: data.user.id,
          hasGoogleDrive: Boolean(data.user.googleDriveConnected),
        });
      }
      return { success: true, message: data.message || 'Email successfully verified!' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Verification request failed' };
    }
  };

  const resendVerification = async (email: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.error || 'Failed to resend verification' };
      }

      return { success: true, message: data.message };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to resend verification' };
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      return {
        success: true,
        message: data.message || 'If an account exists, a reset link was sent.',
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to request password reset' };
    }
  };

  const resetPassword = async (
    tokenOrEmail: string,
    newPasswordOrCode: string,
    maybeNewPassword?: string
  ) => {
    const token = maybeNewPassword ? newPasswordOrCode : tokenOrEmail;
    const newPassword = maybeNewPassword || newPasswordOrCode;
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.error || 'Failed to reset password' };
      }

      if (data.user) {
        setUser({
          ...data.user,
          userId: data.user.id,
          hasGoogleDrive: Boolean(data.user.googleDriveConnected),
        });
      }
      return { success: true, message: data.message || 'Password successfully reset!' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error resetting password' };
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.error || 'Failed to change password' };
      }

      return { success: true, message: data.message || 'Password updated successfully!' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error changing password' };
    }
  };

  const selectPlan = async (plan: UserPlan) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/select-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.error || 'Failed to update plan' };
      }

      if (data.user) {
        setUser({
          ...data.user,
          userId: data.user.id,
          hasGoogleDrive: Boolean(data.user.googleDriveConnected),
        });
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error updating plan' };
    }
  };

  const connectGoogleDrive = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/google/connect?format=json`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        window.location.href = `${BACKEND_URL}/api/google/connect`;
      }
    } catch {
      window.location.href = `${BACKEND_URL}/api/google/connect`;
    }
  };

  const disconnectGoogleDrive = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/google/disconnect`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        return { success: false, error: data.error || 'Failed to disconnect Cloud Storage' };
      }
      await fetchCurrentUser();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to disconnect Cloud Storage' };
    }
  };

  const refreshUser = async () => {
    await fetchCurrentUser();
  };

  const value: AuthContextType = {
    user,
    token: null,
    isAuthenticated: !!user,
    isLoading,
    isPro: user?.plan === 'pro' || user?.plan === 'business',
    hasDriveAccess: Boolean(user?.googleDriveConnected),
    googleDriveConnected: Boolean(user?.googleDriveConnected),
    login,
    loginWithEmail: login,
    loginWithGoogle: connectGoogleDrive,
    register,
    registerWithEmail: (email: string, pass: string, name?: string) =>
      register(email, pass, name, 'free'),
    logout,
    verifyEmail,
    resendVerification,
    forgotPassword,
    requestPasswordReset: forgotPassword,
    resetPassword,
    changePassword,
    selectPlan,
    connectGoogleDrive,
    disconnectGoogleDrive,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

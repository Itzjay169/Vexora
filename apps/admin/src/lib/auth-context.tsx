'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'FINANCE' | 'MODERATOR' | 'AUDITOR';

export interface AdminUser {
  id: string;
  username: string;
  role: AdminRole;
  mfa_verified: boolean;
}

interface AuthContextType {
  user: AdminUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  mfaChallenge: { required: boolean; challengeToken: string | null; user: AdminUser | null };
  loginStep1: (identifier: string, password: string) => Promise<{ mfaRequired: boolean; challengeToken: string }>;
  verifyMfaStep2: (challengeToken: string, code: string) => Promise<boolean>;
  logout: () => void;
  triggerStepUp: (code: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mfaChallenge, setMfaChallenge] = useState<{
    required: boolean;
    challengeToken: string | null;
    user: AdminUser | null;
  }>({ required: false, challengeToken: null, user: null });

  // Load session from storage if present
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('vexora_admin_token');
      const storedUser = localStorage.getItem('vexora_admin_user');
      if (storedToken && storedUser) {
        const parsed = JSON.parse(storedUser);
        // Security rule: Only set user if mfa_verified is true
        if (parsed.mfa_verified) {
          setUser(parsed);
          setAccessToken(storedToken);
        } else {
          localStorage.removeItem('vexora_admin_token');
          localStorage.removeItem('vexora_admin_user');
        }
      }
    } catch {
      // storage unavailable
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginStep1 = async (identifier: string, password: string) => {
    // Primary auth check against API
    const res = await fetch('/api/v1/auth/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error?.message || 'Invalid administrative credentials');
    }

    // Mandatory MFA: Never logs in directly!
    setMfaChallenge({
      required: true,
      challengeToken: data.data.challenge_token,
      user: data.data.user,
    });

    return {
      mfaRequired: true,
      challengeToken: data.data.challenge_token,
    };
  };

  const verifyMfaStep2 = async (challengeToken: string, code: string) => {
    const res = await fetch('/api/v1/auth/admin/mfa-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challenge_token: challengeToken,
        mfa_code: code,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error?.message || 'Invalid MFA verification code');
    }

    const verifiedUser: AdminUser = {
      ...data.data.user,
      mfa_verified: true,
    };

    setUser(verifiedUser);
    setAccessToken(data.data.tokens.accessToken);
    setMfaChallenge({ required: false, challengeToken: null, user: null });

    try {
      localStorage.setItem('vexora_admin_token', data.data.tokens.accessToken);
      localStorage.setItem('vexora_admin_user', JSON.stringify(verifiedUser));
    } catch {
      // ignore
    }

    return true;
  };

  const logout = () => {
    setUser(null);
    setAccessToken(null);
    setMfaChallenge({ required: false, challengeToken: null, user: null });
    try {
      localStorage.removeItem('vexora_admin_token');
      localStorage.removeItem('vexora_admin_user');
    } catch {
      // ignore
    }
  };

  const triggerStepUp = async (code: string) => {
    if (!accessToken) throw new Error('Authentication required');
    const res = await fetch('/api/v1/auth/admin/step-up', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ mfa_code: code }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error?.message || 'Step-up authentication failed');
    }
    return true;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!user && user.mfa_verified,
        isLoading,
        mfaChallenge,
        loginStep1,
        verifyMfaStep2,
        logout,
        triggerStepUp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AuthProvider');
  }
  return context;
}

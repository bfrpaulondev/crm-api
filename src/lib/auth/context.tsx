'use client';

import React, { createContext, useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { useRouter } from 'next/navigation';
import {
  LOGIN_MUTATION,
  REGISTER_MUTATION,
  LOGOUT_MUTATION,
} from '@/graphql/mutations/auth';
import { GET_CURRENT_USER } from '@/graphql/queries/auth';
import { getApolloClient } from '@/lib/apollo/client';
import { setTokens, clearTokens, getAccessToken } from '@/lib/apollo/auth-link';
import type { User, LoginInput, RegisterInput, AuthTokens } from '@/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const [loginMutation] = useMutation(LOGIN_MUTATION);
  const [registerMutation] = useMutation(REGISTER_MUTATION);
  const [logoutMutation] = useMutation(LOGOUT_MUTATION);

  const {
    data: userData,
    loading: userLoading,
    refetch: refetchUser,
  } = useQuery(GET_CURRENT_USER, {
    skip: typeof window === 'undefined' || !getAccessToken(),
    onError: () => {
      // Token might be invalid, clear it
      clearTokens();
      setUser(null);
    },
  });

  useEffect(() => {
    if (userData?.me) {
      setUser(userData.me);
    }
    setIsLoading(userLoading);
  }, [userData, userLoading]);

  const login = useCallback(
    async (input: LoginInput) => {
      setError(null);
      setIsLoading(true);
      try {
        const { data } = await loginMutation({
          variables: { input },
        });

        if (data?.login) {
          const { accessToken, refreshToken, user: loggedInUser } = data.login;
          setTokens(accessToken, refreshToken);
          setUser(loggedInUser);
          
          // Reset Apollo cache for fresh data
          const client = getApolloClient();
          await client.resetStore();
          
          router.push('/dashboard');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Login failed';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [loginMutation, router]
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      setError(null);
      setIsLoading(true);
      try {
        const { data } = await registerMutation({
          variables: { input },
        });

        if (data?.register) {
          const { accessToken, refreshToken, user: registeredUser } = data.register;
          setTokens(accessToken, refreshToken);
          setUser(registeredUser);
          
          // Reset Apollo cache for fresh data
          const client = getApolloClient();
          await client.resetStore();
          
          router.push('/dashboard');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Registration failed';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [registerMutation, router]
  );

  const logout = useCallback(async () => {
    try {
      await logoutMutation();
    } catch {
      // Ignore logout API errors
    } finally {
      clearTokens();
      setUser(null);
      
      // Clear Apollo cache
      const client = getApolloClient();
      await client.clearStore();
      
      router.push('/login');
    }
  }, [logoutMutation, router]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    error,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;

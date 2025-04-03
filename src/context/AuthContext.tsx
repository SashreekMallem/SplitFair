import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../config/supabase';
import * as SecureStore from 'expo-secure-store';
import { logDebug, logError } from '../utils/DebugHelper';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';

// Define AuthState type with explicit initialization
export type AuthState = {
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: string | null;
};

// Define context type
type AuthContextType = {
  user: any | null;
  authState: AuthState;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userData?: any) => Promise<any>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
};

// Create context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  authState: { isAuthenticated: false, isLoading: true, userId: null },
  signIn: async () => {},
  signUp: async () => null,
  signOut: async () => {},
  resetPassword: async () => {},
});

// Auth provider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize authState with an explicit value
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    userId: null
  });
  
  const [user, setUser] = useState<any | null>(null);

  // Initialize auth on mount
  useEffect(() => {
    logDebug('AuthProvider mounted - initializing auth state');
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthChange);
    
    // Check for existing session
    checkForExistingSession();
    
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Handle auth state changes
  const handleAuthChange = async (event: AuthChangeEvent, session: Session | null) => {
    logDebug(`Auth state changed: ${event}`);
    
    if (session && session.user) {
      setUser(session.user);
      setAuthState({
        isAuthenticated: true,
        isLoading: false,
        userId: session.user.id
      });
    } else {
      setUser(null);
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        userId: null
      });
    }
  };

  // Check for existing session on app start
  const checkForExistingSession = async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        throw error;
      }
      
      if (data && data.session) {
        setUser(data.session.user);
        setAuthState({
          isAuthenticated: true,
          isLoading: false,
          userId: data.session.user.id
        });
      } else {
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error: any) {
      logError(`Error checking session: ${error.message}`);
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Sign in
  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        throw error;
      }
      
      if (data && data.user) {
        setUser(data.user);
        setAuthState({
          isAuthenticated: true,
          isLoading: false,
          userId: data.user.id
        });
      }
    } catch (error) {
      throw error;
    }
  };

  // Sign up
  const signUp = async (email: string, password: string, userData?: any) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData,
        }
      });
      
      if (error) {
        throw error;
      }
      
      return data;
    } catch (error) {
      throw error;
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw error;
      }
      
      setUser(null);
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        userId: null
      });
    } catch (error) {
      throw error;
    }
  };

  // Reset password
  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      
      if (error) {
        throw error;
      }
    } catch (error) {
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      authState,
      signIn,
      signUp,
      signOut,
      resetPassword
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

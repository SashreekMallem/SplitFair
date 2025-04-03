import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../config/supabase';
import { User, Session } from '@supabase/supabase-js';
import { logDebug, logError } from '../utils/DebugHelper';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, options?: any) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize on mount
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      logDebug(`Initial session check: ${session ? 'Session found' : 'No session'}`);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      logDebug(`Auth state changed: ${_event} - ${session ? 'User present' : 'No user'}`);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Enhanced signUp with metadata support
  const signUp = async (email: string, password: string, options?: any) => {
    setLoading(true);
    try {
      logDebug(`Sign up attempt for ${email}`);
      const { error } = await supabase.auth.signUp({ email, password, options });
      if (error) throw error;
      logDebug('Sign up successful');
    } catch (error: any) {
      logError(`Sign up error: ${error.message}`);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      logDebug(`Sign in attempt for ${email}`);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      logDebug('Sign in successful');
    } catch (error: any) {
      logError(`Sign in error: ${error.message}`);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Helper to refresh user data
  const refreshUser = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (data?.user) {
        setUser(data.user);
      }
    } catch (error) {
      console.error('Error refreshing user', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (uid) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle();

      if (!error && data) {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    return await supabase.auth.signInWithPassword({ email, password });
  };

  const register = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    // Check if the user already exists (Supabase returns an empty identities array to prevent enumeration)
    if (data?.user && data.user.identities && data.user.identities.length === 0) {
      return { data: null, error: { message: 'An account with this email already exists. Please try again.' } };
    }

    return { data, error };
  };

  const updateProfile = async (profileData) => {
    if (!user) return { error: new Error('User not logged in') };
    
    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .upsert({
                id: user.id,
                email: user.email,
                ...profileData,
                role: profile?.role || 'user'
            })
            .select()
            .single();

        if (error) throw error;
        setProfile(data);
        return { data, error: null };
    } catch(err) {
        console.error('Error updating profile:', err);
        return { data: null, error: err };
    }
  };

  const logout = async () => {
    return await supabase.auth.signOut();
  };

  const value = {
    user,
    profile,
    isAdmin: profile?.role === 'admin',
    loading,
    login,
    register,
    updateProfile,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

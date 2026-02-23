import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await authAPI.getProfile();
      setUser(data.data.user || data.data);
    } catch {
      localStorage.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (credentials) => {
    const { data } = await authAPI.login(credentials);
    localStorage.setItem('accessToken', data.data.accessToken);
    localStorage.setItem('refreshToken', data.data.refreshToken);
    setUser(data.data.user);
    toast.success('Login successful!');
    return data.data.user;
  };

  const register = async (userData) => {
    const { data } = await authAPI.register(userData);
    toast.success(data.message || 'Registration successful! Awaiting approval.');
    return data;
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch { /* ignore */ }
    localStorage.clear();
    setUser(null);
    toast.success('Logged out');
  };

  const updateProfile = async (profileData) => {
    const { data } = await authAPI.updateProfile(profileData);
    setUser(data.data.user || data.data);
    toast.success('Profile updated');
    return data;
  };

  const isAdmin = user?.role === 'admin';
  const isWarden = user?.role === 'warden';
  const isStaff = isAdmin || isWarden;

  return (
    <AuthContext.Provider value={{
      user, loading, login, register, logout, updateProfile,
      loadUser, isAdmin, isWarden, isStaff,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

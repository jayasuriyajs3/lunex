import { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { notificationAPI } from '../services/api';
import {
  LayoutDashboard, WashingMachine, CalendarPlus, CalendarDays,
  Zap, History, AlertTriangle, Bell, User, LogOut, Menu, X,
  Shield, Users, Settings, ChevronDown,
} from 'lucide-react';

const userLinks = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/machines', icon: WashingMachine, label: 'Machines' },
  { to: '/bookings/new', icon: CalendarPlus, label: 'New Booking' },
  { to: '/bookings', icon: CalendarDays, label: 'My Bookings' },
  { to: '/session', icon: Zap, label: 'Active Session' },
  { to: '/sessions', icon: History, label: 'Session History' },
  { to: '/issues', icon: AlertTriangle, label: 'Issues' },
];

const staffLinks = [
  { to: '/admin', icon: Shield, label: 'Admin Dashboard' },
  { to: '/admin/users', icon: Users, label: 'Users', adminOnly: true },
  { to: '/admin/bookings', icon: CalendarDays, label: 'All Bookings' },
  { to: '/admin/sessions', icon: History, label: 'All Sessions' },
  { to: '/admin/issues', icon: AlertTriangle, label: 'All Issues' },
  { to: '/admin/machines', icon: WashingMachine, label: 'Manage Machines' },
  { to: '/admin/config', icon: Settings, label: 'System Config', adminOnly: true },
];

export default function Layout() {
  const { user, logout, isStaff, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [staffMenuOpen, setStaffMenuOpen] = useState(false);

  const fetchUnread = useCallback(async () => {
    try {
      const { data } = await notificationAPI.getUnreadCount();
      setUnreadCount(data.data?.unreadCount ?? 0);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchUnread();
  }, [fetchUnread, location.pathname]);

  useEffect(() => {
    const handleFocus = () => fetchUnread();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchUnread();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchUnread]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const linkClasses = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
      isActive
        ? 'bg-primary-600 text-white shadow-md'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`;

  const visibleStaffLinks = staffLinks.filter(
    (l) => !l.adminOnly || isAdmin
  );

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:inset-auto
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <NavLink to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <WashingMachine className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">LUNEX</span>
            </NavLink>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-500">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {userLinks.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} end className={linkClasses}
                onClick={() => setSidebarOpen(false)}>
                <Icon className="w-5 h-5 shrink-0" />
                {label}
              </NavLink>
            ))}

            {isStaff && (
              <>
                <div className="pt-4 pb-2">
                  <button onClick={() => setStaffMenuOpen(!staffMenuOpen)}
                    className="flex items-center justify-between w-full px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-600">
                    <span>Staff Panel</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${staffMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                {staffMenuOpen && visibleStaffLinks.map(({ to, icon: Icon, label }) => (
                  <NavLink key={to} to={to} end className={linkClasses}
                    onClick={() => setSidebarOpen(false)}>
                    <Icon className="w-5 h-5 shrink-0" />
                    {label}
                  </NavLink>
                ))}
              </>
            )}
          </nav>

          {/* User card */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-semibold text-primary-700">
                  {user?.name?.charAt(0)?.toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-600">
            <Menu className="w-6 h-6" />
          </button>
          <div className="hidden lg:block" />

          <div className="flex items-center gap-3">
            <NavLink to="/notifications" className="relative p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-danger-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </NavLink>
            <NavLink to="/profile" className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition">
              <User className="w-5 h-5" />
            </NavLink>
            <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import PendingApproval from './pages/PendingApproval';
import Dashboard from './pages/Dashboard';
import Machines from './pages/Machines';
import BookingNew from './pages/BookingNew';
import MyBookings from './pages/MyBookings';
import ActiveSession from './pages/ActiveSession';
import SessionHistory from './pages/SessionHistory';
import Issues from './pages/Issues';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import AllBookings from './pages/admin/AllBookings';
import AllSessions from './pages/admin/AllSessions';
import AllIssues from './pages/admin/AllIssues';
import MachineManagement from './pages/admin/MachineManagement';
import SystemConfig from './pages/admin/SystemConfig';

function ProtectedRoute({ children, staffOnly = false, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.accountStatus === 'pending') return <Navigate to="/pending" replace />;
  if (user.accountStatus === 'blocked') return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  if (staffOnly && user.role === 'user') return <Navigate to="/" replace />;
  return children;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-gray-600 font-medium">Loading LUNEX...</p>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
      <Route path="/pending" element={<PendingApproval />} />

      {/* Protected — inside Layout */}
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="machines" element={<Machines />} />
        <Route path="bookings/new" element={<BookingNew />} />
        <Route path="bookings" element={<MyBookings />} />
        <Route path="session" element={<ActiveSession />} />
        <Route path="sessions" element={<SessionHistory />} />
        <Route path="issues" element={<Issues />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<Profile />} />

        {/* Staff routes */}
        <Route path="admin" element={<ProtectedRoute staffOnly><AdminDashboard /></ProtectedRoute>} />
        <Route path="admin/users" element={<ProtectedRoute adminOnly><UserManagement /></ProtectedRoute>} />
        <Route path="admin/bookings" element={<ProtectedRoute staffOnly><AllBookings /></ProtectedRoute>} />
        <Route path="admin/sessions" element={<ProtectedRoute staffOnly><AllSessions /></ProtectedRoute>} />
        <Route path="admin/issues" element={<ProtectedRoute staffOnly><AllIssues /></ProtectedRoute>} />
        <Route path="admin/machines" element={<ProtectedRoute staffOnly><MachineManagement /></ProtectedRoute>} />
        <Route path="admin/config" element={<ProtectedRoute adminOnly><SystemConfig /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

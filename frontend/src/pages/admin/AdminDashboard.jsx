import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../../services/api';
import { Card, PageHeader, StatCard, Spinner, Button } from '../../components/UI';
import {
  LayoutDashboard, Users, WashingMachine, CalendarDays, AlertTriangle,
  TrendingUp, Clock, AlertOctagon, RotateCcw, ShieldAlert
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.getDashboard()
      .then(({ data }) => setDashboard(data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleShutdown = async () => {
    if (!confirm('EMERGENCY: Shut down ALL machines?')) return;
    try {
      await adminAPI.emergencyShutdown();
      toast.success('All machines shut down');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Shutdown failed');
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset all machines to available?')) return;
    try {
      await adminAPI.emergencyReset();
      toast.success('All machines reset');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed');
    }
  };

  if (loading) return <Spinner />;

  const d = dashboard || {};

  return (
    <div className="space-y-6">
      <PageHeader title="Admin Dashboard" subtitle="System overview and analytics"
        action={
          <div className="flex gap-2">
            <Button variant="danger" size="sm" onClick={handleShutdown}>
              <AlertOctagon className="w-4 h-4" /> Emergency Shutdown
            </Button>
            <Button variant="success" size="sm" onClick={handleReset}>
              <RotateCcw className="w-4 h-4" /> Reset All
            </Button>
          </div>
        } />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Users" value={d.users?.total ?? '—'} color="primary" />
        <StatCard icon={WashingMachine} label="Machines" value={d.machines?.total ?? '—'} color="accent" />
        <StatCard icon={CalendarDays} label="Today's Bookings" value={d.today?.bookings ?? '—'} color="warn" />
        <StatCard icon={AlertTriangle} label="Open Issues" value={d.allTime?.openIssues ?? '—'} color="danger" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Clock} label="Machines In Use" value={d.machines?.inUse ?? '—'} color="accent" />
        <StatCard icon={Users} label="Pending Users" value={d.users?.pending ?? '—'} color="warn" />
        <StatCard icon={TrendingUp} label="All-Time Bookings" value={d.allTime?.totalBookings ?? '—'} color="primary" />
        <StatCard icon={ShieldAlert} label="No-Shows Today" value={d.today?.noShows ?? '—'} color="danger" />
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickLink to="/admin/users" icon={Users} label="Manage Users" color="primary" />
        <QuickLink to="/admin/machines" icon={WashingMachine} label="Manage Machines" color="accent" />
        <QuickLink to="/admin/bookings" icon={CalendarDays} label="All Bookings" color="warn" />
        <QuickLink to="/admin/issues" icon={AlertTriangle} label="All Issues" color="danger" />
      </div>
    </div>
  );
}

function QuickLink({ to, icon: Icon, label, color }) {
  const colors = {
    primary: 'hover:border-primary-300 hover:bg-primary-50',
    accent: 'hover:border-accent-300 hover:bg-accent-50',
    warn: 'hover:border-warn-300 hover:bg-warn-50',
    danger: 'hover:border-danger-300 hover:bg-danger-50',
  };
  return (
    <Link to={to}>
      <Card className={`p-5 cursor-pointer transition ${colors[color]}`}>
        <Icon className="w-8 h-8 text-gray-400 mb-2" />
        <p className="font-medium text-gray-900 text-sm">{label}</p>
      </Card>
    </Link>
  );
}

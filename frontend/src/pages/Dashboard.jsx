import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { machineAPI, bookingAPI, sessionAPI, notificationAPI } from '../services/api';
import { Card, StatusBadge, Spinner } from '../components/UI';
import {
  WashingMachine, CalendarDays, Zap, Bell, ArrowRight,
  CalendarPlus, Clock, AlertTriangle,
} from 'lucide-react';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';

export default function Dashboard() {
  const { user } = useAuth();
  const [machines, setMachines] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [mRes, bRes, sRes, nRes] = await Promise.all([
          machineAPI.getAll(),
          bookingAPI.getMyBookings(),
          sessionAPI.getActive().catch(() => ({ data: { data: null } })),
          notificationAPI.getUnreadCount(),
        ]);
        setMachines(mRes.data.data?.machines || mRes.data.data || []);
        setBookings(bRes.data.data?.bookings || bRes.data.data || []);
        setActiveSession(sRes.data.data?.session ?? null);
        setUnread(nRes.data.data?.unreadCount ?? 0);
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <Spinner />;

  const available = machines.filter((m) => m.status === 'available').length;
  const upcoming = bookings.filter((b) => b.status === 'confirmed');
  const nextBooking = upcoming[0];

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome, {user?.name?.split(' ')[0]}! 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">Here's your laundry overview</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent-100 rounded-xl flex items-center justify-center">
              <WashingMachine className="w-5 h-5 text-accent-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Available</p>
              <p className="text-xl font-bold text-gray-900">{available}/{machines.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Upcoming</p>
              <p className="text-xl font-bold text-gray-900">{upcoming.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-warn-50 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-warn-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Active Session</p>
              <p className="text-xl font-bold text-gray-900">{activeSession ? 'Yes' : 'No'}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-danger-50 rounded-xl flex items-center justify-center">
              <Bell className="w-5 h-5 text-danger-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Unread</p>
              <p className="text-xl font-bold text-gray-900">{unread}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Active Session Banner */}
      {activeSession && (
        <Link to="/session">
          <Card className="p-5 bg-gradient-to-r from-accent-500 to-accent-600 text-white cursor-pointer hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Zap className="w-8 h-8" />
                <div>
                  <p className="font-semibold text-lg">Session in Progress</p>
                  <p className="text-accent-100 text-sm">
                    Machine: {activeSession.machine?.name || activeSession.machine?.machineId || 'N/A'}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-6 h-6" />
            </div>
          </Card>
        </Link>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/bookings/new">
          <Card className="p-5 hover:shadow-md transition cursor-pointer group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center group-hover:bg-primary-100 transition">
                <CalendarPlus className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Book Machine</p>
                <p className="text-xs text-gray-500">Reserve a slot</p>
              </div>
            </div>
          </Card>
        </Link>

        <Link to="/machines">
          <Card className="p-5 hover:shadow-md transition cursor-pointer group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-accent-50 rounded-xl flex items-center justify-center group-hover:bg-accent-100 transition">
                <WashingMachine className="w-6 h-6 text-accent-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">View Machines</p>
                <p className="text-xs text-gray-500">Check availability</p>
              </div>
            </div>
          </Card>
        </Link>

        <Link to="/issues">
          <Card className="p-5 hover:shadow-md transition cursor-pointer group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-warn-50 rounded-xl flex items-center justify-center group-hover:bg-warn-100 transition">
                <AlertTriangle className="w-6 h-6 text-warn-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Report Issue</p>
                <p className="text-xs text-gray-500">Machine problems</p>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {/* Next Booking */}
      {nextBooking && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Next Booking</h3>
            <Link to="/bookings" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              View all →
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-primary-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">
                {nextBooking.machine?.name || nextBooking.machine?.machineId || 'Machine'}
              </p>
              <p className="text-sm text-gray-500">
                {formatBookingDate(nextBooking.startTime)} · {nextBooking.durationMinutes} min
              </p>
            </div>
            <StatusBadge status={nextBooking.status} />
          </div>
        </Card>
      )}

      {/* Machine Overview */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Machine Status</h3>
          <Link to="/machines" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {machines.slice(0, 6).map((m) => (
            <div key={m._id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className={`w-3 h-3 rounded-full ${
                m.status === 'available' ? 'bg-accent-500' :
                m.status === 'in-use' ? 'bg-primary-500' :
                m.status === 'maintenance' ? 'bg-warn-500' : 'bg-danger-500'
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{m.name || m.machineId}</p>
                <p className="text-xs text-gray-500">{m.location}</p>
              </div>
              <StatusBadge status={m.status} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function formatBookingDate(dateStr) {
  if (!dateStr) return '';
  const d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
  if (isToday(d)) return `Today, ${format(d, 'h:mm a')}`;
  if (isTomorrow(d)) return `Tomorrow, ${format(d, 'h:mm a')}`;
  return format(d, 'MMM d, h:mm a');
}

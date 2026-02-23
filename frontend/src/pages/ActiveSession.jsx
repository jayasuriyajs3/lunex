import { useState, useEffect, useCallback } from 'react';
import { sessionAPI } from '../services/api';
import { Card, PageHeader, Button, Spinner, EmptyState, StatusBadge } from '../components/UI';
import { Zap, Clock, Timer, Play, Pause, Square, Plus } from 'lucide-react';
import { format, parseISO, differenceInSeconds } from 'date-fns';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

export default function ActiveSession() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [remaining, setRemaining] = useState(0);
  const [actionLoading, setActionLoading] = useState('');

  const load = useCallback(() => {
    sessionAPI.getActive()
      .then(({ data }) => {
        const s = data.data?.session ?? null;
        setSession(s);
        if (s && s._id) {
          const endAt = s.extendedEndAt || s.scheduledEndAt;
          setRemaining(Math.max(0, differenceInSeconds(parseISO(endAt), new Date())));
        }
      })
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Countdown timer
  useEffect(() => {
    if (!session || session.status !== 'running') return;
    const interval = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [session]);

  const doAction = async (action, id) => {
    setActionLoading(action);
    try {
      if (action === 'extend') await sessionAPI.extend(id);
      else if (action === 'end') await sessionAPI.end(id);
      toast.success(action === 'extend' ? 'Session extended +5 min' : 'Session ended');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${action}`);
    } finally {
      setActionLoading('');
    }
  };

  if (loading) return <Spinner />;

  if (!session) {
    return (
      <div>
        <PageHeader title="Active Session" subtitle="Your current washing session" />
        <EmptyState icon={Zap} title="No active session"
          message="You don't have a running session. Book a machine and scan your RFID to start."
          action={<Link to="/bookings/new"><Button>Book Machine</Button></Link>} />
      </div>
    );
  }

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const endAt = session.extendedEndAt || session.scheduledEndAt;
  const progress = session.scheduledEndAt
    ? Math.max(0, 100 - (remaining / differenceInSeconds(parseISO(endAt), parseISO(session.startedAt))) * 100)
    : 0;

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title="Active Session" subtitle="Your current washing session" />

      {/* Timer Card */}
      <Card className="p-8 text-center mb-6">
        <StatusBadge status={session.status} className="mb-4" />

        <div className="relative w-48 h-48 mx-auto mb-6">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="6" />
            <circle cx="50" cy="50" r="45" fill="none" stroke={session.status === 'paused' ? '#f59e0b' : '#22c55e'}
              strokeWidth="6" strokeDasharray={`${progress * 2.83} 283`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-4xl font-mono font-bold text-gray-900">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </p>
            <p className="text-xs text-gray-500 mt-1">remaining</p>
          </div>
        </div>

        <div className="space-y-2 text-sm text-gray-600">
          <p className="flex items-center justify-center gap-2">
            <Clock className="w-4 h-4" />
            Started: {format(parseISO(session.startedAt), 'h:mm a')}
          </p>
          <p className="flex items-center justify-center gap-2">
            <Timer className="w-4 h-4" />
            Ends: {format(parseISO(endAt), 'h:mm a')}
          </p>
        </div>

        {session.extensionGranted && (
          <p className="mt-3 text-xs text-accent-600 bg-accent-50 rounded-lg px-3 py-1.5 inline-block">
            +{session.extensionMinutes} min extension applied
          </p>
        )}
      </Card>

      {/* Machine Info */}
      <Card className="p-5 mb-6">
        <h3 className="font-semibold text-gray-900 mb-3">Machine Details</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Machine</p>
            <p className="font-medium text-gray-900">{session.machine?.name || session.machine?.machineId}</p>
          </div>
          <div>
            <p className="text-gray-500">Location</p>
            <p className="font-medium text-gray-900">{session.machine?.location || '—'}</p>
          </div>
          <div>
            <p className="text-gray-500">Duration</p>
            <p className="font-medium text-gray-900">{session.durationMinutes || '—'} mins</p>
          </div>
          <div>
            <p className="text-gray-500">Status</p>
            <StatusBadge status={session.status} />
          </div>
        </div>
      </Card>

      {/* Actions */}
      {(session.status === 'running' || session.status === 'paused') && (
        <div className="flex gap-3">
          {session.status === 'running' && !session.extensionGranted && (
            <Button variant="outline" className="flex-1" onClick={() => doAction('extend', session._id)}
              loading={actionLoading === 'extend'}>
              <Plus className="w-4 h-4" /> Extend +5 min
            </Button>
          )}
          {session.status === 'running' && (
            <Button variant="danger" className="flex-1" onClick={() => doAction('end', session._id)}
              loading={actionLoading === 'end'}>
              <Square className="w-4 h-4" /> End Session
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { sessionAPI } from '../services/api';
import { Card, StatusBadge, PageHeader, Spinner, EmptyState } from '../components/UI';
import { History, Clock, WashingMachine, Timer } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export default function SessionHistory() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sessionAPI.getHistory()
      .then(({ data }) => setSessions(data.data?.sessions || data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Session History" subtitle="Your past washing sessions" />

      {sessions.length === 0 ? (
        <EmptyState icon={History} title="No sessions yet" message="Your session history will appear here after you complete a wash." />
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <Card key={s._id} className="p-4">
              <div className="flex items-center gap-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                  s.status === 'completed' ? 'bg-accent-100' : 'bg-gray-100'
                }`}>
                  <WashingMachine className={`w-6 h-6 ${
                    s.status === 'completed' ? 'text-accent-600' : 'text-gray-500'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900">
                      {s.machine?.name || s.machine?.machineId || 'Machine'}
                    </p>
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500 mt-1 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {s.startedAt ? format(parseISO(s.startedAt), 'MMM d, h:mm a') : '—'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Timer className="w-3.5 h-3.5" />
                      {s.durationMinutes || '—'} min
                    </span>
                    {s.extensionGranted && (
                      <span className="text-xs text-accent-600">+{s.extensionMinutes}m ext</span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

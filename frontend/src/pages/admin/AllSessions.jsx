import { useState, useEffect } from 'react';
import { sessionAPI } from '../../services/api';
import { Card, StatusBadge, PageHeader, Button, Spinner, EmptyState } from '../../components/UI';
import { History, Clock, User, WashingMachine, Search, Pause, Play, Square } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

export default function AllSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const load = () => {
    sessionAPI.getAll()
      .then(({ data }) => setSessions(data.data?.sessions || data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAction = async (action, id) => {
    try {
      if (action === 'pause') await sessionAPI.pause(id);
      else if (action === 'resume') await sessionAPI.resume(id);
      else if (action === 'force-stop') await sessionAPI.forceStop(id);
      toast.success(`Session ${action}d`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  if (loading) return <Spinner />;

  const filtered = sessions
    .filter((s) => filter === 'all' || s.status === filter)
    .filter((s) => !search ||
      s.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.machine?.machineId?.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div>
      <PageHeader title="All Sessions" subtitle={`${sessions.length} total sessions`} />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user or machine..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'running', 'paused', 'completed', 'terminated'].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                filter === f ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={History} title="No sessions found" />
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <Card key={s._id} className="p-4">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  s.status === 'running' ? 'bg-accent-100' : s.status === 'paused' ? 'bg-warn-50' : 'bg-gray-100'
                }`}>
                  <WashingMachine className={`w-5 h-5 ${
                    s.status === 'running' ? 'text-accent-600' : s.status === 'paused' ? 'text-warn-600' : 'text-gray-500'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900">
                      {s.machine?.name || s.machine?.machineId || 'Machine'}
                    </p>
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5 flex-wrap">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      {s.user?.name || 'User'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {s.startedAt ? format(parseISO(s.startedAt), 'MMM d, h:mm a') : '—'}
                    </span>
                    <span>{s.durationMinutes || '—'}m</span>
                  </div>
                </div>
                {(s.status === 'running' || s.status === 'paused') && (
                  <div className="flex gap-1">
                    {s.status === 'running' && (
                      <Button size="sm" variant="outline" onClick={() => handleAction('pause', s._id)}>
                        <Pause className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {s.status === 'paused' && (
                      <Button size="sm" variant="outline" onClick={() => handleAction('resume', s._id)}>
                        <Play className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button size="sm" variant="danger" onClick={() => handleAction('force-stop', s._id)}>
                      <Square className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

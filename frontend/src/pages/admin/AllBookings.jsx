import { useState, useEffect } from 'react';
import { bookingAPI } from '../../services/api';
import { Card, StatusBadge, PageHeader, Spinner, EmptyState } from '../../components/UI';
import { CalendarDays, Clock, User, WashingMachine, Search } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export default function AllBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    bookingAPI.getAll()
      .then(({ data }) => setBookings(data.data?.bookings || data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const filtered = bookings
    .filter((b) => filter === 'all' || b.status === filter)
    .filter((b) => !search || 
      b.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
      b.machine?.machineId?.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div>
      <PageHeader title="All Bookings" subtitle={`${bookings.length} total bookings`} />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user or machine..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'confirmed', 'active', 'completed', 'cancelled', 'no-show'].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                filter === f ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1).replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No bookings found" />
      ) : (
        <div className="space-y-2">
          {filtered.map((b) => (
            <Card key={b._id} className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center shrink-0">
                  <CalendarDays className="w-5 h-5 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900">
                      {b.machine?.name || b.machine?.machineId || 'Machine'}
                    </p>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5 flex-wrap">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      {b.user?.name || 'User'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {b.startTime ? format(parseISO(b.startTime), 'MMM d, h:mm a') : '—'}
                    </span>
                    <span>{b.durationMinutes}m</span>
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

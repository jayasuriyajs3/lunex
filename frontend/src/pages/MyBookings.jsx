import { useState, useEffect } from 'react';
import { bookingAPI } from '../services/api';
import { Card, StatusBadge, PageHeader, Button, Spinner, EmptyState, Modal } from '../components/UI';
import { CalendarDays, Clock, WashingMachine, X } from 'lucide-react';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelId, setCancelId] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = () => {
    bookingAPI.getMyBookings()
      .then(({ data }) => setBookings(data.data?.bookings || data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await bookingAPI.cancel(cancelId);
      toast.success('Booking cancelled');
      setCancelId(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cancel failed');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <Spinner />;

  const filtered = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);

  return (
    <div>
      <PageHeader title="My Bookings" subtitle="View and manage your bookings"
        action={<Link to="/bookings/new"><Button>New Booking</Button></Link>} />

      <div className="flex flex-wrap gap-2 mb-6">
        {['all', 'confirmed', 'active', 'completed', 'cancelled', 'no-show'].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
              filter === f ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1).replace('-', ' ')}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No bookings"
          message="You haven't made any bookings yet."
          action={<Link to="/bookings/new"><Button>Book Now</Button></Link>} />
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <Card key={b._id} className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 bg-primary-50 rounded-xl flex items-center justify-center shrink-0">
                  <WashingMachine className="w-6 h-6 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900">
                      {b.machine?.name || b.machine?.machineId || 'Machine'}
                    </p>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5" />
                      {formatDate(b.startTime)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatTime(b.startTime)} — {formatTime(b.endTime)} ({b.durationMinutes}m)
                    </span>
                  </div>
                </div>
                {b.status === 'confirmed' && (
                  <button onClick={() => setCancelId(b._id)}
                    className="p-2 text-gray-400 hover:text-danger-500 hover:bg-danger-50 rounded-lg transition">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Cancel modal */}
      <Modal open={!!cancelId} onClose={() => setCancelId(null)} title="Cancel Booking">
        <p className="text-sm text-gray-600 mb-6">Are you sure you want to cancel this booking? This action cannot be undone.</p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setCancelId(null)}>Keep</Button>
          <Button variant="danger" onClick={handleCancel} loading={cancelling}>Cancel Booking</Button>
        </div>
      </Modal>
    </div>
  );
}

function formatDate(d) {
  if (!d) return '';
  const date = parseISO(d);
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'MMM d');
}

function formatTime(d) {
  if (!d) return '';
  return format(parseISO(d), 'h:mm a');
}

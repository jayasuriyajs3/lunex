import { useState, useEffect } from 'react';
import { notificationAPI } from '../services/api';
import { Card, PageHeader, Button, Spinner, EmptyState } from '../components/UI';
import { Bell, CheckCheck, Trash2, Clock, Info, AlertTriangle, Zap, CalendarDays } from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const iconMap = {
  'booking-confirmed': CalendarDays,
  'arrival-reminder': Clock,
  'no-show-warning': AlertTriangle,
  'session-started': Zap,
  'session-ending': Clock,
  'session-completed': Zap,
  'maintenance-alert': AlertTriangle,
  'issue-reported': AlertTriangle,
  'emergency': AlertTriangle,
};

const getBookingTimeRange = (startTime, endTime) => {
  if (!startTime || !endTime) return null;

  const start = typeof startTime === 'string' ? parseISO(startTime) : new Date(startTime);
  const end = typeof endTime === 'string' ? parseISO(endTime) : new Date(endTime);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  return `${format(start, 'h:mm:ss a')} to ${format(end, 'h:mm:ss a')}`;
};

const getNotificationMessage = (notification) => {
  if (notification.type === 'booking-confirmed') {
    const machineName = notification.data?.machineName;
    const bookingRange = getBookingTimeRange(notification.data?.startTime, notification.data?.endTime);

    if (machineName && bookingRange) {
      return `Your slot on ${machineName} is booked from ${bookingRange}.`;
    }
  }

  return notification.message;
};

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    notificationAPI.getAll()
      .then(({ data }) => setNotifications(data.data?.notifications || data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllRead();
      toast.success('All marked as read');
      load();
    } catch {
      toast.error('Failed');
    }
  };

  const handleDelete = async (id) => {
    try {
      await notificationAPI.delete(id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
    } catch {
      toast.error('Failed');
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await notificationAPI.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
    } catch { /* ignore */ }
  };

  if (loading) return <Spinner />;

  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <div>
      <PageHeader title="Notifications" subtitle={`${unread} unread notification${unread !== 1 ? 's' : ''}`}
        action={unread > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
            <CheckCheck className="w-4 h-4" /> Mark all read
          </Button>
        )} />

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" message="You're all caught up!" />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const Icon = iconMap[n.type] || Info;
            return (
              <Card key={n._id}
                className={`p-4 cursor-pointer transition ${!n.isRead ? 'border-l-4 border-l-primary-500 bg-primary-50/30' : ''}`}
                onClick={() => !n.isRead && handleMarkRead(n._id)}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    !n.isRead ? 'bg-primary-100' : 'bg-gray-100'
                  }`}>
                    <Icon className={`w-5 h-5 ${!n.isRead ? 'text-primary-600' : 'text-gray-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${!n.isRead ? 'text-gray-900' : 'text-gray-700'}`}>
                      {n.title}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">{getNotificationMessage(n)}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {n.createdAt ? formatDistanceToNow(parseISO(n.createdAt), { addSuffix: true }) : ''}
                    </p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(n._id); }}
                    className="p-1.5 text-gray-400 hover:text-danger-500 rounded-lg hover:bg-danger-50 transition shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

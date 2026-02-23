import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { machineAPI } from '../services/api';
import { Card, StatusBadge, PageHeader, Spinner, EmptyState } from '../components/UI';
import { WashingMachine, MapPin, Wifi, WifiOff, CalendarPlus } from 'lucide-react';

export default function Machines() {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    machineAPI.getAll()
      .then(({ data }) => setMachines(data.data?.machines || data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? machines : machines.filter((m) => m.status === filter);

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Machines" subtitle="View all washing machines and their status" />

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {['all', 'available', 'in-use', 'maintenance', 'repair', 'disabled'].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition ${
              filter === f
                ? 'bg-primary-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1).replace('-', ' ')}
            {f === 'all' ? ` (${machines.length})` : ` (${machines.filter(m => m.status === f).length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={WashingMachine} title="No machines found" message="No machines match the selected filter." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((machine) => (
            <MachineCard key={machine._id} machine={machine} />
          ))}
        </div>
      )}
    </div>
  );
}

function MachineCard({ machine }) {
  return (
    <Card className="p-5 hover:shadow-md transition">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
            machine.status === 'available' ? 'bg-accent-100' :
            machine.status === 'in-use' ? 'bg-primary-100' : 'bg-gray-100'
          }`}>
            <WashingMachine className={`w-6 h-6 ${
              machine.status === 'available' ? 'text-accent-600' :
              machine.status === 'in-use' ? 'text-primary-600' : 'text-gray-500'
            }`} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{machine.name || machine.machineId}</h3>
            <p className="text-xs text-gray-500 font-mono">{machine.machineId}</p>
          </div>
        </div>
        <StatusBadge status={machine.status} />
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-gray-500">
          <MapPin className="w-4 h-4" />
          <span>{machine.location}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-500">
          {machine.isOnline ? (
            <><Wifi className="w-4 h-4 text-accent-500" /><span className="text-accent-600">Online</span></>
          ) : (
            <><WifiOff className="w-4 h-4 text-gray-400" /><span>Offline</span></>
          )}
        </div>
      </div>

      {machine.status === 'available' && (
        <Link to={`/bookings/new?machine=${machine.machineId}`}
          className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition">
          <CalendarPlus className="w-4 h-4" />
          Book Now
        </Link>
      )}

      {machine.maintenanceNote && (
        <p className="mt-3 text-xs text-warn-600 bg-warn-50 rounded-lg px-3 py-2">
          ⚠ {machine.maintenanceNote}
        </p>
      )}
    </Card>
  );
}

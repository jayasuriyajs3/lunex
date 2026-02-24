import { useState, useEffect } from 'react';
import { machineAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Card, StatusBadge, PageHeader, Button, Spinner, EmptyState, Modal, Input, Select } from '../../components/UI';
import { WashingMachine, Plus, Pencil, Trash2, MapPin, Wifi, WifiOff, Wrench } from 'lucide-react';
import toast from 'react-hot-toast';

const emptyForm = { machineId: '', name: '', location: '', esp32Ip: '', relayPin: 0 };
const statusOptions = [
  { value: 'available', label: 'Available' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'repair', label: 'Repair' },
  { value: 'disabled', label: 'Disabled' },
];

export default function MachineManagement() {
  const { isAdmin } = useAuth();
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [statusModal, setStatusModal] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [maintenanceNote, setMaintenanceNote] = useState('');

  const load = () => {
    machineAPI.getAll()
      .then(({ data }) => setMachines(data.data?.machines || data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (m) => {
    setForm({ machineId: m.machineId, name: m.name, location: m.location, esp32Ip: m.esp32Ip || '', relayPin: m.relayPin || 0 });
    setEditingId(m.machineId);
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await machineAPI.update(editingId, form);
        toast.success('Machine updated');
      } else {
        await machineAPI.create(form);
        toast.success('Machine created');
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this machine?')) return;
    try {
      await machineAPI.delete(id);
      toast.success('Machine deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleStatusUpdate = async () => {
    try {
      await machineAPI.updateStatus(statusModal, { status: newStatus, maintenanceNote });
      toast.success('Status updated');
      setStatusModal(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Machine Management" subtitle={`${machines.length} machines`}
        action={isAdmin ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Machine</Button> : null} />

      {machines.length === 0 ? (
        <EmptyState icon={WashingMachine} title="No machines" message="Add your first machine to get started."
          action={isAdmin ? <Button onClick={openCreate}>Add Machine</Button> : null} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {machines.map((m) => (
            <Card key={m._id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                    m.status === 'available' ? 'bg-accent-100' :
                    m.status === 'in-use' ? 'bg-primary-100' : 'bg-gray-100'
                  }`}>
                    <WashingMachine className={`w-6 h-6 ${
                      m.status === 'available' ? 'text-accent-600' :
                      m.status === 'in-use' ? 'text-primary-600' : 'text-gray-500'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{m.name}</h3>
                    <p className="text-xs text-gray-500 font-mono">{m.machineId}</p>
                  </div>
                </div>
                <StatusBadge status={m.status} />
              </div>

              <div className="space-y-1.5 text-sm mb-4">
                <p className="flex items-center gap-2 text-gray-500">
                  <MapPin className="w-4 h-4" /> {m.location}
                </p>
                <p className="flex items-center gap-2 text-gray-500">
                  {m.isOnline ? <><Wifi className="w-4 h-4 text-accent-500" /> Online</> : <><WifiOff className="w-4 h-4" /> Offline</>}
                </p>
                <p className="text-xs text-gray-400">Usage: {m.totalUsageCount} times · {m.totalUsageMinutes} min</p>
              </div>

              <div className="flex gap-2">
                {isAdmin && (
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(m)}>
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => {
                  setStatusModal(m.machineId);
                  setNewStatus(m.status);
                  setMaintenanceNote(m.maintenanceNote || '');
                }}>
                  <Wrench className="w-3.5 h-3.5" />
                </Button>
                {isAdmin && (
                  <Button size="sm" variant="danger" onClick={() => handleDelete(m.machineId)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)}
        title={editingId ? 'Edit Machine' : 'Add Machine'}>
        <form onSubmit={handleSave} className="space-y-4">
          <Input label="Machine ID" value={form.machineId} onChange={set('machineId')}
            required disabled={!!editingId} placeholder="e.g. WM-004" />
          <Input label="Name" value={form.name} onChange={set('name')}
            required placeholder="e.g. Washing Machine 4" />
          <Input label="Location" value={form.location} onChange={set('location')}
            required placeholder="e.g. Block A, Ground Floor" />
          <Input label="ESP32 IP (optional)" value={form.esp32Ip} onChange={set('esp32Ip')}
            placeholder="e.g. 192.168.1.100" />
          <Input label="Relay Pin" type="number" value={form.relayPin}
            onChange={(e) => setForm({ ...form, relayPin: parseInt(e.target.value) || 0 })} />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editingId ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      {/* Status Modal */}
      <Modal open={!!statusModal} onClose={() => setStatusModal(null)} title="Update Machine Status">
        <Select label="Status" value={newStatus} className="mb-4"
          onChange={(e) => setNewStatus(e.target.value)} options={statusOptions} />
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Maintenance Note</label>
          <textarea value={maintenanceNote} onChange={(e) => setMaintenanceNote(e.target.value)}
            rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Optional note..." />
        </div>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setStatusModal(null)}>Cancel</Button>
          <Button onClick={handleStatusUpdate}>Update</Button>
        </div>
      </Modal>
    </div>
  );
}

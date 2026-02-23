import { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';
import { Card, PageHeader, Button, Input, Spinner, EmptyState } from '../../components/UI';
import { Settings, Plus, Trash2, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SystemConfig() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState('');

  const load = () => {
    adminAPI.getConfig()
      .then(({ data }) => {
        const d = data.data?.configs || data.data || [];
        setConfigs(Array.isArray(d) ? d : Object.entries(d).map(([key, value]) => ({ key, value })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!newKey.trim()) return;
    try {
      await adminAPI.setConfig({ key: newKey.trim(), value: newValue.trim() });
      toast.success('Config added');
      setNewKey('');
      setNewValue('');
      setShowAdd(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleUpdate = async (key) => {
    try {
      await adminAPI.setConfig({ key, value: editValue });
      toast.success('Config updated');
      setEditingKey(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleDelete = async (key) => {
    if (!confirm(`Delete config "${key}"?`)) return;
    try {
      await adminAPI.deleteConfig(key);
      toast.success('Config deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="System Configuration" subtitle="Manage system settings"
        action={<Button onClick={() => setShowAdd(true)}><Plus className="w-4 h-4" /> Add Config</Button>} />

      {showAdd && (
        <Card className="p-5 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Add Configuration</h3>
          <div className="flex gap-3">
            <Input className="flex-1" placeholder="Key" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
            <Input className="flex-1" placeholder="Value" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
            <Button onClick={handleAdd}>Add</Button>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {configs.length === 0 ? (
        <EmptyState icon={Settings} title="No configurations" message="Add your first system config." />
      ) : (
        <div className="space-y-2">
          {configs.map((c) => (
            <Card key={c.key || c._id} className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
                  <Settings className="w-5 h-5 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono font-medium text-gray-900">{c.key}</p>
                  {editingKey === c.key ? (
                    <input value={editValue} onChange={(e) => setEditValue(e.target.value)}
                      className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      autoFocus />
                  ) : (
                    <p className="text-sm text-gray-500 truncate">
                      {typeof c.value === 'object' ? JSON.stringify(c.value) : String(c.value)}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  {editingKey === c.key ? (
                    <>
                      <Button size="sm" variant="success" onClick={() => handleUpdate(c.key)}>
                        <Save className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditingKey(null)}>✕</Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => {
                        setEditingKey(c.key);
                        setEditValue(typeof c.value === 'object' ? JSON.stringify(c.value) : String(c.value));
                      }}>Edit</Button>
                      <Button size="sm" variant="danger" onClick={() => handleDelete(c.key)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

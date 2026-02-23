import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import { Card, PageHeader, Button, Input } from '../components/UI';
import { User, Mail, Phone, Home, Building2, CreditCard, Shield, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    roomNumber: user?.roomNumber || '',
    hostelBlock: user?.hostelBlock || '',
  });
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile(form);
      setEditing(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      toast.error('Passwords don\'t match');
      return;
    }
    setSaving(true);
    try {
      await authAPI.changePassword({
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
      });
      toast.success('Password changed');
      setChangingPwd(false);
      setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title="Profile" subtitle="Manage your account settings" />

      {/* Info Card */}
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
            <span className="text-2xl font-bold text-primary-700">
              {user?.name?.charAt(0)?.toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{user?.name}</h2>
            <p className="text-sm text-gray-500">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 text-primary-700 rounded-full text-xs font-medium capitalize">
                <Shield className="w-3 h-3" /> {user?.role}
              </span>
            </div>
          </div>
        </div>

        {!editing ? (
          <div className="space-y-4">
            <InfoRow icon={Mail} label="Email" value={user?.email} />
            <InfoRow icon={Phone} label="Phone" value={user?.phone} />
            <InfoRow icon={Home} label="Room" value={user?.roomNumber} />
            <InfoRow icon={Building2} label="Block" value={user?.hostelBlock} />
            <InfoRow icon={CreditCard} label="RFID" value={user?.rfidUID || 'Not assigned'} />
            <div className="pt-4 flex gap-3">
              <Button onClick={() => setEditing(true)}>Edit Profile</Button>
              <Button variant="outline" onClick={() => setChangingPwd(true)}>
                <Lock className="w-4 h-4" /> Change Password
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Input label="Name" value={form.name} onChange={set('name')} />
            <Input label="Phone" value={form.phone} onChange={set('phone')} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Room Number" value={form.roomNumber} onChange={set('roomNumber')} />
              <Input label="Hostel Block" value={form.hostelBlock} onChange={set('hostelBlock')} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={handleSave} loading={saving}>Save</Button>
              <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Stats */}
      <Card className="p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Statistics</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-900">{user?.totalBookings || 0}</p>
            <p className="text-xs text-gray-500">Bookings</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{user?.totalSessions || 0}</p>
            <p className="text-xs text-gray-500">Sessions</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-danger-500">{user?.noShowCount || 0}</p>
            <p className="text-xs text-gray-500">No-Shows</p>
          </div>
        </div>
      </Card>

      {/* Change Password Modal */}
      {changingPwd && (
        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Change Password</h3>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <Input type="password" label="Current Password" value={pwdForm.currentPassword}
              onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })} required />
            <Input type="password" label="New Password" value={pwdForm.newPassword} minLength={6}
              onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })} required />
            <Input type="password" label="Confirm New Password" value={pwdForm.confirmPassword}
              onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })} required />
            <div className="flex gap-3">
              <Button type="submit" loading={saving}>Update Password</Button>
              <Button variant="secondary" type="button" onClick={() => setChangingPwd(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 text-gray-400" />
      <span className="text-sm text-gray-500 w-16">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value || '—'}</span>
    </div>
  );
}

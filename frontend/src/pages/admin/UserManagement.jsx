import { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';
import { Card, StatusBadge, PageHeader, Button, Spinner, EmptyState, Modal, Input, Select } from '../../components/UI';
import {
  Users, UserCheck, UserX, Shield, CreditCard, Ban, Unlock,
  RotateCcw, Search, ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [actionModal, setActionModal] = useState(null);
  const [actionData, setActionData] = useState({});
  const [acting, setActing] = useState(false);

  const load = () => {
    adminAPI.getUsers()
      .then(({ data }) => setUsers(data.data?.users || data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const doAction = async (action) => {
    setActing(true);
    try {
      const payload = { userId: actionModal.userId || actionModal._id, ...actionData };
      switch (action) {
        case 'approve': await adminAPI.approveUser(payload); break;
        case 'reject': await adminAPI.rejectUser(payload); break;
        case 'block': await adminAPI.blockUser(payload); break;
        case 'unblock': await adminAPI.unblockUser(payload); break;
        case 'assign-rfid': await adminAPI.assignRfid(payload); break;
        case 'revoke-rfid': await adminAPI.revokeRfid(payload); break;
        case 'change-role': await adminAPI.changeRole(payload); break;
        case 'reset-password': await adminAPI.resetPassword(payload); break;
      }
      toast.success(`Action completed`);
      setActionModal(null);
      setActionData({});
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setActing(false);
    }
  };

  if (loading) return <Spinner />;

  const filtered = users
    .filter((u) => filter === 'all' || u.accountStatus === filter || u.role === filter)
    .filter((u) => !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()));

  const pending = users.filter((u) => u.accountStatus === 'pending');

  return (
    <div>
      <PageHeader title="User Management" subtitle={`${users.length} total users · ${pending.length} pending`} />

      {/* Pending Banner */}
      {pending.length > 0 && (
        <Card className="p-4 mb-6 bg-warn-50 border-warn-200">
          <p className="text-sm font-medium text-warn-700">
            {pending.length} user{pending.length > 1 ? 's' : ''} awaiting approval
          </p>
        </Card>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'active', 'blocked', 'user', 'warden', 'admin'].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                filter === f ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Users List */}
      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No users found" />
      ) : (
        <div className="space-y-2">
          {filtered.map((user) => (
            <UserRow key={user._id} user={user}
              onAction={(action) => { setActionModal({ ...user, action }); setActionData({}); }} />
          ))}
        </div>
      )}

      {/* Action Modal */}
      <Modal open={!!actionModal} onClose={() => setActionModal(null)}
        title={`${actionModal?.action?.replace('-', ' ')?.toUpperCase()} — ${actionModal?.name}`}>
        {actionModal?.action === 'assign-rfid' && (
          <Input label="RFID UID" value={actionData.rfidUID || ''} className="mb-4"
            onChange={(e) => setActionData({ rfidUID: e.target.value })} placeholder="e.g. USER0002" />
        )}
        {actionModal?.action === 'change-role' && (
          <Select label="New Role" value={actionData.role || 'user'} className="mb-4"
            onChange={(e) => setActionData({ role: e.target.value })}
            options={[
              { value: 'user', label: 'User' },
              { value: 'warden', label: 'Warden' },
              { value: 'admin', label: 'Admin' },
            ]} />
        )}
        {actionModal?.action === 'reset-password' && (
          <Input label="New Password" type="password" value={actionData.newPassword || ''} className="mb-4"
            onChange={(e) => setActionData({ newPassword: e.target.value })} placeholder="Min 6 characters" />
        )}
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to <strong>{actionModal?.action?.replace('-', ' ')}</strong> this user?
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setActionModal(null)}>Cancel</Button>
          <Button onClick={() => doAction(actionModal?.action)} loading={acting}>
            Confirm
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function UserRow({ user, onAction }) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
          <span className="text-sm font-semibold text-primary-700">
            {user.name?.charAt(0)?.toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-gray-900">{user.name}</p>
            <StatusBadge status={user.accountStatus} />
            <span className="text-xs text-gray-400 capitalize bg-gray-100 px-2 py-0.5 rounded-full">{user.role}</span>
          </div>
          <p className="text-sm text-gray-500">{user.email}</p>
          <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
            <span>Room: {user.roomNumber || '—'}</span>
            <span>Block: {user.hostelBlock || '—'}</span>
            <span>RFID: {user.rfidUID || 'None'}</span>
          </div>
        </div>
        <button onClick={() => setOpen(!open)}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
          <ChevronDown className={`w-5 h-5 transition ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
          {user.accountStatus === 'pending' && (
            <>
              <Button size="sm" variant="success" onClick={() => onAction('approve')}>
                <UserCheck className="w-3.5 h-3.5" /> Approve
              </Button>
              <Button size="sm" variant="danger" onClick={() => onAction('reject')}>
                <UserX className="w-3.5 h-3.5" /> Reject
              </Button>
            </>
          )}
          {user.accountStatus === 'active' && (
            <Button size="sm" variant="danger" onClick={() => onAction('block')}>
              <Ban className="w-3.5 h-3.5" /> Block
            </Button>
          )}
          {user.accountStatus === 'blocked' && (
            <Button size="sm" variant="success" onClick={() => onAction('unblock')}>
              <Unlock className="w-3.5 h-3.5" /> Unblock
            </Button>
          )}
          {!user.rfidUID ? (
            <Button size="sm" variant="outline" onClick={() => onAction('assign-rfid')}>
              <CreditCard className="w-3.5 h-3.5" /> Assign RFID
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => onAction('revoke-rfid')}>
              <CreditCard className="w-3.5 h-3.5" /> Revoke RFID
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => onAction('change-role')}>
            <Shield className="w-3.5 h-3.5" /> Change Role
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onAction('reset-password')}>
            <RotateCcw className="w-3.5 h-3.5" /> Reset Password
          </Button>
        </div>
      )}
    </Card>
  );
}

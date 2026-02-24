import { useState, useEffect } from 'react';
import { issueAPI, machineAPI } from '../services/api';
import { Card, StatusBadge, PageHeader, Button, Spinner, EmptyState, Modal, Input, Select } from '../components/UI';
import { AlertTriangle, Plus, Clock, WashingMachine, Gift } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

export default function Issues() {
  const [issues, setIssues] = useState([]);
  const [rebooks, setRebooks] = useState([]);
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReport, setShowReport] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [form, setForm] = useState({ machineId: '', issueType: 'water', description: '' });

  const load = () => {
    Promise.all([
      issueAPI.getMyIssues(),
      issueAPI.getPendingRebooks().catch(() => ({ data: { data: [] } })),
      machineAPI.getAll(),
    ])
      .then(([iRes, rRes, mRes]) => {
        setIssues(iRes.data.data?.issues || iRes.data.data || []);
        setRebooks(rRes.data.data?.rebooks || rRes.data.data || []);
        setMachines(mRes.data.data?.machines || mRes.data.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleReport = async (e) => {
    e.preventDefault();
    setReporting(true);
    try {
      await issueAPI.report(form);
      toast.success('Issue reported');
      setShowReport(false);
      setForm({ machineId: '', issueType: 'water', description: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to report');
    } finally {
      setReporting(false);
    }
  };

  const handleRebookRespond = async (id, action) => {
    try {
      await issueAPI.respondToRebook(id, { action });
      toast.success(action === 'accept' ? 'Rebook accepted!' : 'Rebook declined');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Issues" subtitle="Report and track machine issues"
        action={<Button onClick={() => setShowReport(true)}><Plus className="w-4 h-4" /> Report Issue</Button>} />

      {/* Priority Rebooks */}
      {rebooks.length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary-600" /> Priority Rebook Offers
          </h3>
          {rebooks.map((r) => (
            <Card key={r._id} className="p-4 mb-3 border-l-4 border-l-primary-500">
              <p className="text-sm text-gray-600 mb-3">
                You've been offered a priority rebook due to a machine issue. Would you like to rebook?
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleRebookRespond(r._id, 'accept')}>Accept</Button>
                <Button size="sm" variant="secondary" onClick={() => handleRebookRespond(r._id, 'decline')}>Decline</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* My Issues */}
      {issues.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No issues"
          message="You haven't reported any issues yet." />
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => (
            <Card key={issue._id} className="p-4">
              <div className="flex items-center gap-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                  issue.status === 'resolved' ? 'bg-accent-100' : 'bg-warn-50'
                }`}>
                  <AlertTriangle className={`w-6 h-6 ${
                    issue.status === 'resolved' ? 'text-accent-600' : 'text-warn-600'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900 capitalize">
                      {issue.issueType?.replace('-', ' ')}
                    </p>
                    <StatusBadge status={issue.status} />
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5 truncate">{issue.description}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                    <span className="flex items-center gap-1">
                      <WashingMachine className="w-3 h-3" />
                      {issue.machine?.name || issue.machine?.machineId || 'Machine'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {issue.createdAt ? format(parseISO(issue.createdAt), 'MMM d, h:mm a') : '—'}
                    </span>
                  </div>
                </div>
              </div>
              {issue.resolutionNote && (
                <p className="mt-3 text-xs text-accent-700 bg-accent-50 rounded-lg px-3 py-2">
                  Resolution: {issue.resolutionNote}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Report Modal */}
      <Modal open={showReport} onClose={() => setShowReport(false)} title="Report an Issue">
        <form onSubmit={handleReport} className="space-y-4">
          <Select label="Machine" value={form.machineId}
            onChange={(e) => setForm({ ...form, machineId: e.target.value })}
            options={[
              { value: '', label: 'Select a machine...' },
              ...machines.map((m) => ({ value: m.machineId, label: `${m.name || m.machineId} — ${m.location}` })),
            ]}
          />
          <Select label="Issue Type" value={form.issueType}
            onChange={(e) => setForm({ ...form, issueType: e.target.value })}
            options={[
              { value: 'water', label: 'Water Issue' },
              { value: 'power', label: 'Power Issue' },
              { value: 'machine-fault', label: 'Machine Fault' },
              { value: 'other', label: 'Other' },
            ]}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea required maxLength={500} rows={3} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Describe the issue..." />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowReport(false)}>Cancel</Button>
            <Button type="submit" loading={reporting}>Submit Report</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

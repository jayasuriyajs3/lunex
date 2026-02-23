import { useState, useEffect } from 'react';
import { issueAPI } from '../../services/api';
import { Card, StatusBadge, PageHeader, Button, Spinner, EmptyState, Modal } from '../../components/UI';
import { AlertTriangle, Search, CheckCircle, XCircle, Eye, Gift, Clock, User, WashingMachine } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

export default function AllIssues() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [resolveModal, setResolveModal] = useState(null);
  const [resolutionNote, setResolutionNote] = useState('');

  const load = () => {
    issueAPI.getAll()
      .then(({ data }) => setIssues(data.data?.issues || data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleVerify = async (id) => {
    try {
      await issueAPI.verify(id);
      toast.success('Issue verified');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleResolve = async () => {
    try {
      await issueAPI.resolve(resolveModal, { resolutionNote });
      toast.success('Issue resolved');
      setResolveModal(null);
      setResolutionNote('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleDismiss = async (id) => {
    try {
      await issueAPI.dismiss(id);
      toast.success('Issue dismissed');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handlePriorityRebook = async (id) => {
    try {
      await issueAPI.offerPriorityRebook(id, {});
      toast.success('Priority rebook offered');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  if (loading) return <Spinner />;

  const filtered = issues
    .filter((i) => filter === 'all' || i.status === filter)
    .filter((i) => !search ||
      i.reportedBy?.name?.toLowerCase().includes(search.toLowerCase()) ||
      i.machine?.machineId?.toLowerCase().includes(search.toLowerCase()) ||
      i.issueType?.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div>
      <PageHeader title="All Issues" subtitle={`${issues.length} total issues`} />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search issues..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'reported', 'verified', 'resolved', 'dismissed'].map((f) => (
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
        <EmptyState icon={AlertTriangle} title="No issues found" />
      ) : (
        <div className="space-y-2">
          {filtered.map((issue) => (
            <Card key={issue._id} className="p-4">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  issue.status === 'resolved' ? 'bg-accent-100' :
                  issue.status === 'verified' ? 'bg-primary-100' : 'bg-warn-50'
                }`}>
                  <AlertTriangle className={`w-5 h-5 ${
                    issue.status === 'resolved' ? 'text-accent-600' :
                    issue.status === 'verified' ? 'text-primary-600' : 'text-warn-600'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900 capitalize">
                      {issue.issueType?.replace('-', ' ')}
                    </p>
                    <StatusBadge status={issue.status} />
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">{issue.description}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-1 flex-wrap">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {issue.reportedBy?.name || 'User'}
                    </span>
                    <span className="flex items-center gap-1">
                      <WashingMachine className="w-3 h-3" />
                      {issue.machine?.name || issue.machine?.machineId || 'Machine'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {issue.createdAt ? format(parseISO(issue.createdAt), 'MMM d, h:mm a') : '—'}
                    </span>
                  </div>
                  {issue.resolutionNote && (
                    <p className="mt-2 text-xs text-accent-700 bg-accent-50 px-3 py-1.5 rounded-lg">
                      ✓ {issue.resolutionNote}
                    </p>
                  )}
                </div>
                {(issue.status === 'reported' || issue.status === 'verified') && (
                  <div className="flex gap-1 shrink-0">
                    {issue.status === 'reported' && (
                      <Button size="sm" variant="outline" onClick={() => handleVerify(issue._id)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button size="sm" variant="success" onClick={() => setResolveModal(issue._id)}>
                      <CheckCircle className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDismiss(issue._id)}>
                      <XCircle className="w-3.5 h-3.5" />
                    </Button>
                    {!issue.priorityRebookOffered && (
                      <Button size="sm" variant="outline" onClick={() => handlePriorityRebook(issue._id)}>
                        <Gift className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!resolveModal} onClose={() => setResolveModal(null)} title="Resolve Issue">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Resolution Note</label>
          <textarea value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)}
            rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Describe how the issue was resolved..." />
        </div>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setResolveModal(null)}>Cancel</Button>
          <Button variant="success" onClick={handleResolve}>Resolve</Button>
        </div>
      </Modal>
    </div>
  );
}

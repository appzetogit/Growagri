import React, { useState, useEffect, useCallback } from 'react';
import { FiSearch, FiCheck, FiX, FiSlash, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import adminWorkerService from '../../../../services/adminWorkerService';

const STATUS_STYLES = {
  approved: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
  suspended: 'bg-gray-200 text-gray-700'
};

const Workers = () => {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [approvalStatus, setApprovalStatus] = useState('');
  const [busyId, setBusyId] = useState(null);

  const fetchWorkers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminWorkerService.getAllWorkers({ search: search || undefined, approvalStatus: approvalStatus || undefined, limit: 100 });
      setWorkers(res.data || []);
    } catch {
      toast.error('Failed to load workers');
    } finally {
      setLoading(false);
    }
  }, [search, approvalStatus]);

  useEffect(() => {
    const t = setTimeout(fetchWorkers, 300);
    return () => clearTimeout(t);
  }, [fetchWorkers]);

  const act = async (id, fn, okMsg) => {
    try {
      setBusyId(id);
      const res = await fn();
      if (res?.success === false) throw new Error(res.message);
      toast.success(okMsg);
      fetchWorkers();
    } catch (e) {
      toast.error(e.response?.data?.message || e.message || 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-3 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, email..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm"
          />
        </div>
        <select value={approvalStatus} onChange={(e) => setApprovalStatus(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="p-3">Worker</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Approval</th>
              <th className="p-3">Active</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-6 text-center text-gray-400">Loading...</td></tr>
            ) : workers.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-gray-400">No workers found</td></tr>
            ) : workers.map((w) => (
              <tr key={w._id} className="border-t border-gray-100">
                <td className="p-3 font-semibold text-gray-800">{w.name}<div className="text-xs text-gray-400 font-normal">{w.email}</div></td>
                <td className="p-3">{w.phone}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-lg text-xs font-bold ${STATUS_STYLES[w.approvalStatus] || ''}`}>{w.approvalStatus}</span>
                </td>
                <td className="p-3">
                  <button
                    disabled={busyId === w._id}
                    onClick={() => act(w._id, () => adminWorkerService.toggleStatus(w._id, !w.isActive), w.isActive ? 'Worker blocked' : 'Worker activated')}
                    className={`px-2 py-1 rounded-lg text-xs font-bold ${w.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                  >
                    {w.isActive !== false ? 'Active' : 'Blocked'}
                  </button>
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-2">
                    {w.approvalStatus !== 'approved' && (
                      <button title="Approve" disabled={busyId === w._id} onClick={() => act(w._id, () => adminWorkerService.approveWorker(w._id), 'Worker approved')} className="p-2 rounded-lg bg-green-50 text-green-600"><FiCheck /></button>
                    )}
                    {w.approvalStatus !== 'rejected' && (
                      <button
                        title="Reject"
                        disabled={busyId === w._id}
                        onClick={() => {
                          const reason = window.prompt('Reason for rejection?');
                          if (reason) act(w._id, () => adminWorkerService.rejectWorker(w._id, reason), 'Worker rejected');
                        }}
                        className="p-2 rounded-lg bg-red-50 text-red-600"
                      ><FiX /></button>
                    )}
                    {w.approvalStatus === 'approved' && (
                      <button title="Suspend" disabled={busyId === w._id} onClick={() => act(w._id, () => adminWorkerService.suspendWorker(w._id), 'Worker suspended')} className="p-2 rounded-lg bg-gray-100 text-gray-600"><FiSlash /></button>
                    )}
                    <button
                      title="Delete"
                      disabled={busyId === w._id}
                      onClick={() => window.confirm(`Delete ${w.name}?`) && act(w._id, () => adminWorkerService.deleteWorker(w._id), 'Worker deleted')}
                      className="p-2 rounded-lg bg-red-50 text-red-600"
                    ><FiTrash2 /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Workers;

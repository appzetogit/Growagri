import React, { useState, useEffect } from 'react';
import { FiSearch, FiUser, FiPhone, FiMail, FiSlash, FiCheck, FiTrash2, FiEdit2, FiCreditCard } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { adminUserService } from '../../../../services/adminUserService';
import Modal from '../../components/Modal';

const AllFarmers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, inactive
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  // Multi-select (ids on the current page only; cleared whenever the list is refetched)
  const [selectedIds, setSelectedIds] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    email: '',
    isActive: true,
    walletBalance: 0
  });
  const [isUpdating, setIsUpdating] = useState(false);

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 500);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setSelectedIds([]);
      const params = {
        page,
        limit: 10,
        search: debouncedSearch
      };

      if (statusFilter !== 'all') {
        params.isActive = statusFilter === 'active';
      }

      const response = await adminUserService.getAllUsers(params);
      if (response.success) {
        setUsers(response.data);
        setTotalPages(response.pagination.pages);
        setTotalUsers(response.pagination.total);
        // Deleting the last rows of the last page leaves it empty -> step back
        if (response.data.length === 0 && page > 1) setPage(page - 1);
      }
    } catch (error) {
      console.error('Error fetching farmers:', error);
      toast.error('Failed to load farmers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, debouncedSearch, statusFilter]);

  const handleStatusToggle = async (userId, currentStatus) => {
    if (!window.confirm(`Are you sure you want to ${currentStatus ? 'block' : 'activate'} this user?`)) {
      return;
    }

    try {
      const response = await adminUserService.toggleUserStatus(userId, !currentStatus);
      if (response.success) {
        toast.success(response.message);
        setUsers(users.map(user =>
          user._id === userId ? { ...user, isActive: !currentStatus } : user
        ));
      }
    } catch (error) {
      toast.error(error.message || 'Failed to update farmer status');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Permanently delete this farmer from the database? This cannot be undone.')) {
      return;
    }

    try {
      const response = await adminUserService.deleteUser(userId);
      if (response.success) {
        toast.success(response.message);
        fetchUsers();
      }
    } catch (error) {
      toast.error(error.message || 'Failed to delete farmer');
    }
  };

  const allOnPageSelected = users.length > 0 && selectedIds.length === users.length;

  const toggleSelect = (userId) => {
    setSelectedIds(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  const toggleSelectAll = () => {
    setSelectedIds(allOnPageSelected ? [] : users.map(user => user._id));
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.length;
    if (!window.confirm(`Permanently delete ${count} farmer${count > 1 ? 's' : ''} from the database? This cannot be undone.`)) {
      return;
    }

    try {
      setIsDeleting(true);
      const response = await adminUserService.bulkDeleteUsers(selectedIds);
      if (response.success) {
        if (response.deleted.length > 0) {
          toast.success(`${response.deleted.length} farmer${response.deleted.length > 1 ? 's' : ''} deleted`);
        }
        if (response.skipped.length > 0) {
          toast.error(
            `Not deleted (booking in progress): ${response.skipped.map(s => s.name || s.id).join(', ')}`,
            { duration: 6000 }
          );
        }
        fetchUsers();
      }
    } catch (error) {
      toast.error(error.message || 'Failed to delete farmers');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setEditForm({
      name: user.name || '',
      phone: user.phone || '',
      email: user.email || '',
      isActive: user.isActive !== undefined ? user.isActive : true,
      walletBalance: Number(user.wallet?.balance || 0)
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    if (!editForm.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!editForm.phone.trim()) {
      toast.error('Phone number is required');
      return;
    }

    try {
      setIsUpdating(true);
      const payload = {
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        email: editForm.email.trim() || undefined,
        isActive: Boolean(editForm.isActive),
        walletBalance: parseFloat(editForm.walletBalance) || 0
      };

      const res = await adminUserService.updateUser(editingUser._id, payload);
      if (res.success) {
        toast.success(res.message || 'Farmer and wallet updated successfully');
        // Update local state directly
        setUsers(prev => prev.map(u => (u._id === editingUser._id ? {
          ...u,
          name: res.data.name,
          phone: res.data.phone,
          email: res.data.email,
          isActive: res.data.isActive,
          wallet: res.data.wallet || { balance: payload.walletBalance, penalty: u.wallet?.penalty || 0 }
        } : u)));
        setIsEditModalOpen(false);
        setEditingUser(null);
      }
    } catch (err) {
      console.error('Update error:', err);
      toast.error(err.message || 'Failed to update farmer');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search farmers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiTrash2 className="w-3.5 h-3.5" />
              {isDeleting ? 'Deleting...' : `Delete selected (${selectedIds.length})`}
            </button>
          )}

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none focus:border-green-500 cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Blocked Only</option>
          </select>

          <div className="px-3 py-2 bg-green-50 rounded-lg border border-green-100">
            <span className="text-xs font-bold text-green-700">{totalUsers} Farmers</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="pl-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleSelectAll}
                    disabled={loading || users.length === 0}
                    aria-label="Select all farmers on this page"
                    className="w-3.5 h-3.5 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Farmer</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Wallet Balance</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Joined Date</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-xs text-gray-500">Loading farmers...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-xs text-gray-500">No farmers found</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user._id}
                    className={`transition-colors ${selectedIds.includes(user._id) ? 'bg-red-50/40' : 'hover:bg-gray-50'}`}
                  >
                    <td className="pl-4 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(user._id)}
                        onChange={() => toggleSelect(user._id)}
                        aria-label={`Select ${user.name}`}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                          <FiUser className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-xs">{user.name}</p>
                          <p className="text-[10px] text-gray-400">ID: {user._id.slice(-6).toUpperCase()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-gray-600 text-[11px]">
                          <FiMail className="w-3 h-3 text-gray-400" />
                          <span>{user.email || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-600 text-[11px]">
                          <FiPhone className="w-3 h-3 text-gray-400" />
                          <span>{user.phone}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-800 font-semibold text-xs">
                        <span className="text-[10px] text-emerald-600 font-normal">₹</span>
                        <span>{Number(user.wallet?.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${user.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                        }`}>
                        {user.isActive ? 'Active' : 'Blocked'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] text-gray-600 font-medium">
                        {new Date(user.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric', month: 'short', day: 'numeric'
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(user)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Farmer & Wallet"
                        >
                          <FiEdit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleStatusToggle(user._id, user.isActive)}
                          className={`p-1.5 rounded-lg transition-colors ${user.isActive
                            ? 'text-red-500 hover:bg-red-50'
                            : 'text-green-500 hover:bg-green-50'
                            }`}
                          title={user.isActive ? 'Block Farmer' : 'Activate Farmer'}
                        >
                          {user.isActive ? <FiSlash className="w-3.5 h-3.5" /> : <FiCheck className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user._id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Farmer Permanently"
                        >
                          <FiTrash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && users.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/30">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">
              Showing {users.length} of {totalUsers} farmers
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 disabled:opacity-50 hover:bg-white transition-all"
              >
                Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 disabled:opacity-50 hover:bg-white transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Farmer & Wallet Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          if (!isUpdating) {
            setIsEditModalOpen(false);
            setEditingUser(null);
          }
        }}
        title="Edit Farmer & Wallet Balance"
        size="md"
      >
        {editingUser && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            {/* Farmer Overview Card */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm">
                {editingUser.name ? editingUser.name.charAt(0).toUpperCase() : 'F'}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-gray-900 truncate">{editingUser.name}</h4>
                <p className="text-[11px] text-gray-500">
                  ID: {editingUser._id.slice(-6).toUpperCase()} • Joined: {new Date(editingUser.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                editForm.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {editForm.isActive ? 'Active' : 'Blocked'}
              </span>
            </div>

            {/* Basic Info Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                  placeholder="Farmer Full Name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={editForm.phone}
                  onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                  placeholder="10-digit mobile number"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                  placeholder="farmer@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Account Status</label>
                <select
                  value={editForm.isActive ? 'active' : 'blocked'}
                  onChange={(e) => setEditForm(prev => ({ ...prev, isActive: e.target.value === 'active' }))}
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 cursor-pointer"
                >
                  <option value="active">Active (Access Allowed)</option>
                  <option value="blocked">Blocked (Login Restricted)</option>
                </select>
              </div>
            </div>

            {/* Wallet Balance Adjustment Box */}
            <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <FiCreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-900">Wallet Balance (₹)</label>
                    <p className="text-[10px] text-gray-500">
                      Current in Wallet: ₹{Number(editingUser.wallet?.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                {parseFloat(editForm.walletBalance || 0) !== (editingUser.wallet?.balance || 0) && (
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                    parseFloat(editForm.walletBalance || 0) > (editingUser.wallet?.balance || 0)
                      ? 'text-emerald-700 bg-emerald-100'
                      : 'text-amber-700 bg-amber-100'
                  }`}>
                    {parseFloat(editForm.walletBalance || 0) > (editingUser.wallet?.balance || 0) ? '+' : ''}
                    ₹{(parseFloat(editForm.walletBalance || 0) - (editingUser.wallet?.balance || 0)).toFixed(2)}
                  </span>
                )}
              </div>

              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">₹</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.walletBalance}
                  onChange={(e) => setEditForm(prev => ({ ...prev, walletBalance: e.target.value }))}
                  className="w-full pl-8 pr-4 py-2 text-sm font-bold text-gray-900 bg-white border border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  placeholder="0.00"
                />
              </div>

              {/* Quick Adjustment Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-gray-500 font-medium">Quick Add:</span>
                {[100, 500, 1000, 2000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setEditForm(prev => ({
                      ...prev,
                      walletBalance: ((parseFloat(prev.walletBalance) || 0) + amt).toFixed(2)
                    }))}
                    className="px-2 py-1 text-[10px] font-semibold bg-white border border-emerald-200 text-emerald-700 rounded-md hover:bg-emerald-100 transition-colors shadow-2xs"
                  >
                    +{amt}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setEditForm(prev => ({ ...prev, walletBalance: 0 }))}
                  className="px-2 py-1 text-[10px] font-semibold bg-white border border-gray-200 text-gray-600 rounded-md hover:bg-gray-100 transition-colors ml-auto"
                >
                  Reset 0
                </button>
              </div>
              <p className="text-[10px] text-gray-400">
                * Changing balance will update the farmer&apos;s wallet and record an audit transaction in history.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                disabled={isUpdating}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdating}
                className="px-5 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default AllFarmers;


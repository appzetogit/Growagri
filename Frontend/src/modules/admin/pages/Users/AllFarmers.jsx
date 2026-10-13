import React, { useState, useEffect } from 'react';
import { FiSearch, FiUser, FiPhone, FiMail, FiSlash, FiCheck, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { adminUserService } from '../../../../services/adminUserService';

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
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Joined Date</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-xs text-gray-500">Loading farmers...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-xs text-gray-500">No farmers found</td>
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
                          <FiMail className="w-3 h-3" />
                          <span>{user.email}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-600 text-[11px]">
                          <FiPhone className="w-3 h-3" />
                          <span>{user.phone}</span>
                        </div>
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
    </div>
  );
};

export default AllFarmers;

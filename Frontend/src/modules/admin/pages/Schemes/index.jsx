import React, { useState, useEffect, useCallback } from 'react';
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiSearch,
  FiExternalLink,
  FiUpload,
  FiCheck,
  FiX,
  FiAward,
  FiLayers,
  FiEye,
  FiPhone,
  FiRefreshCw
} from 'react-icons/fi';
import { FaWhatsapp, FaTractor, FaLandmark, FaShieldAlt } from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import CardShell from '../../components/CardShell';
import Modal from '../../components/Modal';
import adminSchemeService from '../../../../services/adminSchemeService';
import API from '../../../../services/api';

const ICON_TYPES = [
  { value: 'tractor', label: 'Tractor (Machinery/Farmer)' },
  { value: 'wheat', label: 'Wheat (Crops/Farming)' },
  { value: 'rupee', label: 'Rupee ₹ (Credit/Finance)' },
  { value: 'sprout', label: 'Sprout (Soil/Growth)' },
  { value: 'landmark', label: 'Landmark (Government)' },
  { value: 'shield', label: 'Shield (Insurance/Protection)' },
];

const PRESET_BADGES = [
  { name: 'Emerald', bg: 'bg-[#dcfce7]', text: 'text-[#166534]' },
  { name: 'Amber', bg: 'bg-[#fef3c7]', text: 'text-[#b45309]' },
  { name: 'Sky Blue', bg: 'bg-[#e0f2fe]', text: 'text-[#2563eb]' },
  { name: 'Purple', bg: 'bg-[#f3e8ff]', text: 'text-[#9333ea]' },
  { name: 'Rose', bg: 'bg-[#ffe4e6]', text: 'text-[#be123c]' },
];

export default function SchemeManagement() {
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const initialForm = {
    title: '',
    fullName: '',
    subtitleLine1: '',
    subtitleLine2: '',
    slug: '',
    category: 'Central Government Scheme',
    bannerImage: '',
    badgeBg: 'bg-[#dcfce7]',
    iconColor: 'text-[#166534]',
    iconType: 'landmark',
    shortDescription: '',
    detailedDescription: '',
    benefits: '',
    eligibility: '',
    documentsRequired: '',
    officialPortalUrl: '',
    whatsappNumber: '+91 91177 04450',
    whatsappMessage: 'Namaste GrooAgri Team, I need more information about this scheme. Please guide me.',
    order: 0,
    isActive: true,
  };

  const [form, setForm] = useState(initialForm);

  const fetchSchemes = useCallback(() => {
    setLoading(true);
    const params = {};
    if (statusFilter !== '') params.status = statusFilter;
    if (search) params.search = search;

    adminSchemeService
      .getSchemes(params)
      .then((res) => {
        if (res.success) {
          setSchemes(res.data);
        }
      })
      .catch((error) => {
        toast.error('Failed to load schemes');
        console.error(error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [statusFilter, search]);

  useEffect(() => {
    let isMounted = true;
    const params = {};
    if (statusFilter !== '') params.status = statusFilter;
    if (search) params.search = search;

    adminSchemeService
      .getSchemes(params)
      .then((res) => {
        if (isMounted && res.success) {
          setSchemes(res.data);
        }
      })
      .catch((error) => {
        if (isMounted) toast.error('Failed to load schemes');
        console.error(error);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [statusFilter, search]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchSchemes();
  };

  const handleOpenModal = (scheme = null) => {
    if (scheme) {
      setEditingId(scheme._id);
      setForm({
        title: scheme.title || '',
        fullName: scheme.fullName || '',
        subtitleLine1: scheme.subtitleLine1 || '',
        subtitleLine2: scheme.subtitleLine2 || '',
        slug: scheme.slug || '',
        category: scheme.category || 'Central Government Scheme',
        bannerImage: scheme.bannerImage || '',
        badgeBg: scheme.badgeBg || 'bg-[#dcfce7]',
        iconColor: scheme.iconColor || 'text-[#166534]',
        iconType: scheme.iconType || 'landmark',
        shortDescription: scheme.shortDescription || '',
        detailedDescription: scheme.detailedDescription || '',
        benefits: Array.isArray(scheme.benefits) ? scheme.benefits.join('\n') : (scheme.benefits || ''),
        eligibility: Array.isArray(scheme.eligibility) ? scheme.eligibility.join('\n') : (scheme.eligibility || ''),
        documentsRequired: Array.isArray(scheme.documentsRequired) ? scheme.documentsRequired.join('\n') : (scheme.documentsRequired || ''),
        officialPortalUrl: scheme.officialPortalUrl || '',
        whatsappNumber: scheme.whatsappNumber || '+91 91177 04450',
        whatsappMessage: scheme.whatsappMessage || '',
        order: scheme.order ?? 0,
        isActive: scheme.isActive ?? true,
      });
    } else {
      setEditingId(null);
      setForm(initialForm);
    }
    setIsModalOpen(true);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploading(true);
      const res = await API.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        setForm((prev) => ({ ...prev, bannerImage: res.data.imageUrl }));
        toast.success('Banner image uploaded successfully!');
      }
    } catch (error) {
      toast.error('Image upload failed');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.fullName || !form.officialPortalUrl) {
      toast.error('Title, Full Name, and Official Portal Link are required');
      return;
    }

    try {
      setSubmitting(true);
      if (editingId) {
        const res = await adminSchemeService.updateScheme(editingId, form);
        if (res.success) {
          toast.success('Scheme updated successfully');
          setIsModalOpen(false);
          fetchSchemes();
        }
      } else {
        const res = await adminSchemeService.createScheme(form);
        if (res.success) {
          toast.success('Scheme created successfully');
          setIsModalOpen(false);
          fetchSchemes();
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error saving scheme');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (scheme) => {
    try {
      const res = await adminSchemeService.toggleSchemeStatus(scheme._id);
      if (res.success) {
        toast.success(res.message);
        setSchemes((prev) =>
          prev.map((s) => (s._id === scheme._id ? { ...s, isActive: !s.isActive } : s))
        );
      }
    } catch (error) {
      toast.error('Failed to change scheme status');
      console.error(error);
    }
  };

  const handleDelete = async (scheme) => {
    if (!window.confirm(`Are you sure you want to delete "${scheme.title}"?`)) return;

    try {
      const res = await adminSchemeService.deleteScheme(scheme._id);
      if (res.success) {
        toast.success('Scheme deleted successfully');
        setSchemes((prev) => prev.filter((s) => s._id !== scheme._id));
      }
    } catch (error) {
      toast.error('Failed to delete scheme');
      console.error(error);
    }
  };

  const activeCount = schemes.filter((s) => s.isActive).length;
  const totalCount = schemes.length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Schemes</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</h3>
            <p className="text-xs text-slate-400 mt-0.5">Government programs</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
            <FiAward />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active on User App</p>
            <h3 className="text-2xl font-bold text-emerald-600 mt-1">{activeCount}</h3>
            <p className="text-xs text-slate-400 mt-0.5">Visible to farmers</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
            <FiCheck />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Inactive Schemes</p>
            <h3 className="text-2xl font-bold text-slate-600 mt-1">{totalCount - activeCount}</h3>
            <p className="text-xs text-slate-400 mt-0.5">Hidden from farmers</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center text-xl">
            <FiLayers />
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-5 text-white shadow-md flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-100">WhatsApp Inquiries</p>
            <h3 className="text-lg font-bold mt-1">Direct Farmer Help</h3>
            <p className="text-xs text-emerald-100/90 mt-0.5">Configured per scheme</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-white/20 text-white flex items-center justify-center text-2xl">
            <FaWhatsapp />
          </div>
        </div>
      </div>

      {/* Main Container */}
      <CardShell>
        {/* Header Controls */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Government Schemes Catalog</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage all agricultural welfare schemes, official application portals, and WhatsApp support.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative">
              <input
                type="text"
                placeholder="Search schemes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 w-48 sm:w-60"
              />
              <FiSearch className="absolute left-3 top-2.5 text-slate-400 text-sm" />
            </form>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-2 px-3 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-600 bg-white"
            >
              <option value="">All Status</option>
              <option value="true">Active Only</option>
              <option value="false">Inactive Only</option>
            </select>

            {/* Refresh */}
            <button
              onClick={fetchSchemes}
              title="Refresh"
              className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors"
            >
              <FiRefreshCw className="w-4 h-4" />
            </button>

            {/* Add Scheme Button */}
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 bg-[#166534] hover:bg-[#14532d] text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs hover:shadow-md transition-all active:scale-95"
            >
              <FiPlus className="w-4 h-4" /> Add New Scheme
            </button>
          </div>
        </div>

        {/* Schemes Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-20 text-center">
              <div className="w-9 h-9 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-500">Loading government schemes...</p>
            </div>
          ) : schemes.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-2xl mx-auto mb-3">
                <FiAward />
              </div>
              <h4 className="text-sm font-semibold text-slate-700">No Schemes Found</h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                Click "+ Add New Scheme" to register your first dynamic government program.
              </p>
              <button
                onClick={() => handleOpenModal()}
                className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-medium hover:bg-emerald-700 transition-colors"
              >
                <FiPlus /> Add Scheme
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
                  <th className="py-3 px-4">Scheme</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Official Portal</th>
                  <th className="py-3 px-4">WhatsApp Inquiry</th>
                  <th className="py-3 px-3 text-center">Order</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schemes.map((scheme) => (
                  <tr key={scheme._id} className="hover:bg-slate-50/50 transition-colors group">
                    {/* Scheme Name & Banner */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/60 flex-shrink-0 relative">
                          {scheme.bannerImage ? (
                            <img
                              src={scheme.bannerImage}
                              alt={scheme.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400 bg-emerald-50 text-emerald-700 font-bold">
                              {scheme.title.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors text-sm">
                            {scheme.title}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5">
                            {scheme.fullName}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200/50">
                        {scheme.category || 'General'}
                      </span>
                    </td>

                    {/* Official Portal */}
                    <td className="py-3.5 px-4">
                      <a
                        href={scheme.officialPortalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 font-medium hover:underline max-w-[200px] truncate"
                      >
                        <span className="truncate">{scheme.officialPortalUrl}</span>
                        <FiExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                      </a>
                    </td>

                    {/* WhatsApp */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                        <FaWhatsapp className="text-green-600 text-sm flex-shrink-0" />
                        <span>{scheme.whatsappNumber || '+91 91177 04450'}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate max-w-[190px] mt-0.5">
                        {scheme.whatsappMessage || 'Dynamic template active'}
                      </p>
                    </td>

                    {/* Order */}
                    <td className="py-3.5 px-3 text-center">
                      <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                        #{scheme.order ?? 0}
                      </span>
                    </td>

                    {/* Status Toggle */}
                    <td className="py-3.5 px-3 text-center">
                      <button
                        onClick={() => handleToggleStatus(scheme)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                          scheme.isActive
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            scheme.isActive ? 'bg-emerald-600' : 'bg-slate-400'
                          }`}
                        />
                        {scheme.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Live Preview Button */}
                        <a
                          href={`/user/schemes/${scheme.slug || scheme._id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View Live Details Page"
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          <FiEye className="w-3.5 h-3.5" />
                        </a>

                        {/* Edit Button */}
                        <button
                          onClick={() => handleOpenModal(scheme)}
                          title="Edit Scheme"
                          className="p-1.5 rounded-lg border border-slate-200 text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <FiEdit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDelete(scheme)}
                          title="Delete Scheme"
                          className="p-1.5 rounded-lg border border-slate-200 text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <FiTrash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </CardShell>

      {/* Add / Edit Scheme Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Government Scheme' : 'Add New Government Scheme'}
        size="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto px-1">
          {/* Row 1: Title & Full Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Short Title <span className="text-red-500">*</span> (e.g. PM-Kisan)
              </label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="PM-Kisan"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Official Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Pradhan Mantri Kisan Samman Nidhi"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Row 2: Subtitle Line 1 & Line 2 (For cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Card Subtitle Line 1
              </label>
              <input
                type="text"
                value={form.subtitleLine1}
                onChange={(e) => setForm({ ...form, subtitleLine1: e.target.value })}
                placeholder="Farmer income"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Card Subtitle Line 2
              </label>
              <input
                type="text"
                value={form.subtitleLine2}
                onChange={(e) => setForm({ ...form, subtitleLine2: e.target.value })}
                placeholder="support"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category
              </label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Direct Income Support / Insurance"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Row 3: Banner Image Upload & Preview */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Hero Banner Image (Displayed on Details Page)
            </label>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <input
                type="text"
                value={form.bannerImage}
                onChange={(e) => setForm({ ...form, bannerImage: e.target.value })}
                placeholder="Enter banner image URL or upload file"
                className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              <label className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors border border-slate-300">
                <FiUpload /> {uploading ? 'Uploading...' : 'Upload Image'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </div>

            {form.bannerImage && (
              <div className="relative rounded-xl overflow-hidden h-32 border border-slate-200">
                <img
                  src={form.bannerImage}
                  alt="Banner Preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, bannerImage: '' })}
                  className="absolute top-2 right-2 p-1 bg-black/60 text-white rounded-full text-xs hover:bg-black/80"
                >
                  <FiX />
                </button>
              </div>
            )}
          </div>

          {/* Row 4: Icon & Badge Styling */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Scheme Icon Type
              </label>
              <select
                value={form.iconType}
                onChange={(e) => setForm({ ...form, iconType: e.target.value })}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
              >
                {ICON_TYPES.map((icon) => (
                  <option key={icon.value} value={icon.value}>
                    {icon.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Badge Theme Color Preset
              </label>
              <div className="flex gap-2 pt-1">
                {PRESET_BADGES.map((b) => (
                  <button
                    type="button"
                    key={b.name}
                    onClick={() => setForm({ ...form, badgeBg: b.bg, iconColor: b.text })}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                      form.badgeBg === b.bg ? 'ring-2 ring-emerald-500' : ''
                    } ${b.bg} ${b.text}`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 5: Official Portal Link */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Official Portal Link <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="url"
                required
                value={form.officialPortalUrl}
                onChange={(e) => setForm({ ...form, officialPortalUrl: e.target.value })}
                placeholder="https://pmkisan.gov.in/"
                className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              <FiExternalLink className="absolute left-2.5 top-2.5 text-slate-400" />
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Farmers clicking "Visit Official Portal" will be directed to this link.
            </p>
          </div>

          {/* Row 6: WhatsApp Dynamic Settings (Crucial) */}
          <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
              <FaWhatsapp className="text-emerald-600 text-base" />
              WhatsApp Admin Connect Configuration
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  WhatsApp Contact Phone Number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={form.whatsappNumber}
                    onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
                    placeholder="+91 91177 04450"
                    className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <FiPhone className="absolute left-2.5 top-2.5 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Display Order Ranking
                </label>
                <input
                  type="number"
                  value={form.order}
                  onChange={(e) => setForm({ ...form, order: Number(e.target.value) })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Dynamic Pre-filled WhatsApp Message Template
              </label>
              <textarea
                rows={2}
                value={form.whatsappMessage}
                onChange={(e) => setForm({ ...form, whatsappMessage: e.target.value })}
                placeholder="Namaste GrooAgri Team, I need help regarding this scheme..."
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              <p className="text-[10px] text-slate-500 mt-0.5">
                When a user clicks the floating WhatsApp icon on this scheme's page, this message will be pre-filled automatically.
              </p>
            </div>
          </div>

          {/* Row 7: Descriptions */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Short Description / Card Summary
            </label>
            <input
              type="text"
              value={form.shortDescription}
              onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
              placeholder="Brief 1-2 sentence highlight shown on homepage"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Detailed Description (About Scheme)
            </label>
            <textarea
              rows={3}
              value={form.detailedDescription}
              onChange={(e) => setForm({ ...form, detailedDescription: e.target.value })}
              placeholder="Comprehensive details explaining the scheme objectives, funding, and benefits..."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Row 8: Key Benefits & Eligibility (1 item per line) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Key Benefits (One bullet per line)
              </label>
              <textarea
                rows={3}
                value={form.benefits}
                onChange={(e) => setForm({ ...form, benefits: e.target.value })}
                placeholder="₹6,000 yearly financial assistance&#10;Direct bank account transfer&#10;100% centrally sponsored"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Eligibility Criteria (One bullet per line)
              </label>
              <textarea
                rows={3}
                value={form.eligibility}
                onChange={(e) => setForm({ ...form, eligibility: e.target.value })}
                placeholder="All landholding farmer families&#10;Cultivable land in their name&#10;Aadhaar linked bank account"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Row 9: Required Documents */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Required Documents (One document per line)
            </label>
            <textarea
              rows={2}
              value={form.documentsRequired}
              onChange={(e) => setForm({ ...form, documentsRequired: e.target.value })}
              placeholder="Aadhaar Card&#10;Land Record / Khatauni&#10;Bank Passbook"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Active Status Checkbox */}
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="w-4 h-4 text-emerald-600 rounded-sm border-slate-300 focus:ring-emerald-500"
            />
            <label htmlFor="isActive" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Active (Visible to farmers on Homepage and search)
            </label>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-[#166534] hover:bg-[#14532d] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-60"
            >
              {submitting ? 'Saving...' : editingId ? 'Update Scheme' : 'Create Scheme'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

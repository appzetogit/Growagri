import React, { useState, useEffect } from 'react';
import {
  FiAward,
  FiFileText,
  FiCheck,
  FiSave,
  FiCheckCircle,
  FiUpload,
  FiTrash2,
  FiPlus,
  FiEye,
  FiEyeOff,
  FiExternalLink,
  FiShield,
  FiTrendingUp,
  FiImage,
  FiStar,
  FiUsers,
  FiRefreshCw,
  FiArrowRight,
  FiDownload,
} from 'react-icons/fi';
import { FaSeedling, FaHandshake } from 'react-icons/fa6';
import { toast } from 'react-hot-toast';
import CardShell from '../../components/CardShell';
import API from '../../../../services/api';
import LogoLoader from '../../../../components/common/LogoLoader';
import { uploadToCloudinary } from '../../../../services/cloudinaryService';
import defaultRecognitionImg from '../../../landing/landing_images/bihar_startup_recognition.jpg';

const ICON_OPTIONS = [
  { value: 'award', label: 'Award', icon: FiAward },
  { value: 'leaf', label: 'Leaf / Sprout', icon: FaSeedling },
  { value: 'file', label: 'Certificate / Doc', icon: FiFileText },
  { value: 'handshake', label: 'Handshake', icon: FaHandshake },
  { value: 'shield', label: 'Shield', icon: FiShield },
  { value: 'trending', label: 'Trending', icon: FiTrendingUp },
  { value: 'check', label: 'Check Circle', icon: FiCheckCircle },
  { value: 'star', label: 'Star', icon: FiStar },
  { value: 'users', label: 'Users', icon: FiUsers },
];

const renderIcon = (type) => {
  switch (type) {
    case 'leaf':
    case 'sprout':
      return <FaSeedling className="text-emerald-600 text-base" />;
    case 'file':
    case 'certificate':
      return <FiFileText className="text-emerald-600 text-base" />;
    case 'handshake':
      return <FaHandshake className="text-emerald-600 text-base" />;
    case 'shield':
      return <FiShield className="text-emerald-500 text-base" />;
    case 'trending':
      return <FiTrendingUp className="text-blue-500 text-base" />;
    case 'check':
      return <FiCheckCircle className="text-green-500 text-base" />;
    case 'star':
      return <FiStar className="text-yellow-500 text-base" />;
    case 'users':
      return <FiUsers className="text-purple-500 text-base" />;
    case 'award':
    default:
      return <FiAward className="text-amber-500 text-base" />;
  }
};

const DEFAULT_FORM = {
  badge: '',
  headingPrefix: '',
  headingHighlight: '',
  description: '',
  detailsLinkText: '',
  tagline: '',
  taglineSub: '',
  buttonText: '',
  buttonUrl: '',
  certificateUrl: '',
  imageUrl: '',
  highlights: [],
  isActive: true,
};

const StartupRecognitionAdmin = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);

  const [form, setForm] = useState(DEFAULT_FORM);

  useEffect(() => {
    fetchRecognition();
  }, []);

  const fetchRecognition = async () => {
    try {
      setLoading(true);
      const res = await API.get('/content/startup-recognition');
      if (res.data?.success && res.data?.data) {
        const data = res.data.data;
        const certUrl =
          data.certificateUrl ||
          (data.imageUrl && !data.imageUrl.startsWith('/landing_images') ? data.imageUrl : '') ||
          '';
        setForm((prev) => ({
          ...prev,
          ...data,
          certificateUrl: certUrl,
          imageUrl: certUrl,
          highlights:
            Array.isArray(data.highlights) && data.highlights.length > 0
              ? data.highlights
              : prev.highlights,
        }));
      }
    } catch (err) {
      console.error('Failed to load recognition content:', err);
      toast.error('Failed to load Startup Recognition content');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleHighlightChange = (index, field, value) => {
    setForm((prev) => {
      const updated = [...prev.highlights];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, highlights: updated };
    });
  };

  const handleAddHighlight = () => {
    if ((form.highlights || []).length >= 6) {
      toast.error('Maximum 6 highlights allowed');
      return;
    }
    setForm((prev) => ({
      ...prev,
      highlights: [
        ...(prev.highlights || []),
        {
          title: '',
          subtitle: '',
          iconType: 'award',
        },
      ],
    }));
  };

  const handleRemoveHighlight = (index) => {
    setForm((prev) => ({
      ...prev,
      highlights: (prev.highlights || []).filter((_, i) => i !== index),
    }));
  };

  // Upload and dynamically save certificate file
  const handleCertificateUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (JPG, PNG, WebP)');
      return;
    }

    const toastId = toast.loading('Uploading & saving certificate...');
    try {
      setUploadingCert(true);
      const formData = new FormData();
      formData.append('file', file);

      let uploadedUrl = '';

      // 1. Try dedicated endpoint first (direct upload + save in DB)
      try {
        const res = await API.post('/content/startup-recognition/upload-certificate', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (res.data?.success && res.data?.certificateUrl) {
          uploadedUrl = res.data.certificateUrl;
        }
      } catch (err) {
        console.warn('Dedicated endpoint failed, trying fallback...', err);
      }

      // 2. Try generic /upload endpoint
      if (!uploadedUrl) {
        try {
          const res = await API.post('/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          if (res.data?.success && res.data?.imageUrl) {
            uploadedUrl = res.data.imageUrl;
          }
        } catch (err) {
          console.warn('Generic /upload failed...', err);
        }
      }

      // 3. Fallback to Cloudinary service if backend endpoints fail
      if (!uploadedUrl) {
        uploadedUrl = await uploadToCloudinary(file);
      }

      if (!uploadedUrl) {
        throw new Error('Failed to obtain uploaded certificate URL');
      }

      // Update state immediately
      setForm((prev) => ({
        ...prev,
        certificateUrl: uploadedUrl,
        imageUrl: uploadedUrl,
      }));

      // Dynamically persist to database
      try {
        await API.put('/content/startup-recognition', {
          ...form,
          certificateUrl: uploadedUrl,
          imageUrl: uploadedUrl,
        });
      } catch (saveErr) {
        console.warn('Auto-save after upload warning:', saveErr);
      }

      toast.dismiss(toastId);
      toast.success('Certificate uploaded and saved dynamically!');
    } catch (err) {
      console.error('Certificate upload error:', err);
      toast.dismiss(toastId);
      toast.error(err.response?.data?.message || err.message || 'Failed to upload certificate');
    } finally {
      setUploadingCert(false);
      e.target.value = '';
    }
  };

  // Reset to default certificate dynamically
  const handleResetCertificate = async () => {
    try {
      setForm((prev) => ({ ...prev, certificateUrl: '', imageUrl: '' }));
      await API.put('/content/startup-recognition', {
        ...form,
        certificateUrl: '',
        imageUrl: '',
      });
      toast.success('Reset to default official certificate!');
    } catch (err) {
      console.error('Failed to reset certificate:', err);
      toast.error('Failed to reset certificate');
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        ...form,
        imageUrl: form.certificateUrl || form.imageUrl || '',
      };
      const res = await API.put('/content/startup-recognition', payload);
      if (res.data?.success) {
        toast.success('Startup Recognition settings updated successfully!');
      }
    } catch (err) {
      console.error('Save error:', err);
      toast.error(err.response?.data?.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LogoLoader message="Loading Startup Recognition Settings..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <FiAward className="text-2xl" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Startup Recognition & Ecosystem Support
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Manage recognition details, credentials, highlights, and callout action box
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Active Status Badge Button */}
          <button
            type="button"
            onClick={() => handleInputChange('isActive', !form.isActive)}
            className={`inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              form.isActive
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
            }`}
          >
            {form.isActive ? (
              <>
                <FiEye className="text-emerald-600 text-sm" />
                <span>Visible on Landing Page</span>
              </>
            ) : (
              <>
                <FiEyeOff className="text-gray-500 text-sm" />
                <span>Hidden from Landing Page</span>
              </>
            )}
          </button>

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <>
                <FiRefreshCw className="animate-spin text-base" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <FiSave className="text-base" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Text & Content Settings */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* General Texts Card */}
            <CardShell
              icon={FiAward}
              title="Recognition Section Content"
              subtitle="Headlines, Eyebrow Badge, and Narrative Text"
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Eyebrow Badge Text
                  </label>
                  <input
                    type="text"
                    value={form.badge}
                    onChange={(e) => handleInputChange('badge', e.target.value)}
                    placeholder="e.g. Bihar Startup Recognition"
                    className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Headline Prefix
                    </label>
                    <input
                      type="text"
                      value={form.headingPrefix}
                      onChange={(e) => handleInputChange('headingPrefix', e.target.value)}
                      placeholder="e.g. Recognized under the"
                      className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Highlighted Headline Text
                    </label>
                    <input
                      type="text"
                      value={form.headingHighlight}
                      onChange={(e) => handleInputChange('headingHighlight', e.target.value)}
                      placeholder="e.g. Bihar Startup Policy 2022"
                      className="w-full px-3.5 py-2 text-sm border border-emerald-300 bg-emerald-50/40 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-semibold text-emerald-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Detailed Narrative Description
                  </label>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="GROO Agri is a been selected for seed funding consideration under the Bihar Startup Policy 2022..."
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none leading-relaxed"
                  />
                  <div className="text-right text-[11px] text-gray-400 mt-1">
                    {form.description.length} characters
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Details Link Label
                  </label>
                  <input
                    type="text"
                    value={form.detailsLinkText}
                    onChange={(e) => handleInputChange('detailsLinkText', e.target.value)}
                    placeholder="e.g. View Recognition Details"
                    className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none font-medium"
                  />
                </div>
              </div>
            </CardShell>

            {/* Highlights Pillars Card */}
            <CardShell
              icon={FiShield}
              title="Impact Highlights & Credentials"
              subtitle="The 3 info cards shown in the middle section"
            >
              <div className="space-y-3.5">
                {(!form.highlights || form.highlights.length === 0) && (
                  <p className="text-xs text-gray-400 italic text-center py-3 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                    No highlight cards added yet. Click below to add one.
                  </p>
                )}

                {(form.highlights || []).map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-gray-200 bg-white hover:border-emerald-300 transition-all flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-gray-50 border border-gray-200 shrink-0">
                        {renderIcon(item.iconType)}
                      </div>
                      <select
                        value={item.iconType}
                        onChange={(e) => handleHighlightChange(idx, 'iconType', e.target.value)}
                        className="text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-gray-50 outline-none font-medium cursor-pointer"
                      >
                        {ICON_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => handleHighlightChange(idx, 'title', e.target.value)}
                        placeholder="Highlight Title (e.g. Recognized Startup)"
                        className="w-full px-3 py-1.5 text-xs font-bold border border-gray-300 rounded-md outline-none focus:ring-1 focus:ring-green-500"
                      />
                      <input
                        type="text"
                        value={item.subtitle}
                        onChange={(e) => handleHighlightChange(idx, 'subtitle', e.target.value)}
                        placeholder="Subtitle (e.g. Under Bihar Startup Policy 2022)"
                        className="w-full px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-md outline-none focus:ring-1 focus:ring-green-500"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveHighlight(idx)}
                      className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors shrink-0 cursor-pointer"
                      title="Remove highlight"
                    >
                      <FiTrash2 className="text-sm" />
                    </button>
                  </div>
                ))}

                {(form.highlights || []).length < 6 && (
                  <button
                    type="button"
                    onClick={handleAddHighlight}
                    className="w-full py-2.5 border-2 border-dashed border-gray-300 hover:border-green-500 rounded-xl text-xs font-bold text-gray-600 hover:text-green-600 transition-colors flex items-center justify-center gap-1.5 bg-gray-50/50 hover:bg-green-50/30 cursor-pointer"
                  >
                    <FiPlus className="text-sm" />
                    <span>Add Another Highlight Card</span>
                  </button>
                )}
              </div>
            </CardShell>

          </div>

          {/* Right Column: Callout Box, Certificate Upload & Live Preview */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Supporting Box Settings */}
            <CardShell
              icon={FaHandshake}
              title="Farmer Support Callout Box"
              subtitle="Rightmost card with icon, headline, and action button"
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Callout Box Title
                  </label>
                  <input
                    type="text"
                    value={form.tagline}
                    onChange={(e) => handleInputChange('tagline', e.target.value)}
                    placeholder="e.g. Supporting Bihar's Farmers"
                    className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Callout Subtitle / Motto
                  </label>
                  <input
                    type="text"
                    value={form.taglineSub}
                    onChange={(e) => handleInputChange('taglineSub', e.target.value)}
                    placeholder="e.g. With innovation, technology and commitment."
                    className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Button Label
                    </label>
                    <input
                      type="text"
                      value={form.buttonText}
                      onChange={(e) => handleInputChange('buttonText', e.target.value)}
                      placeholder="e.g. Explore More"
                      className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      External Portal URL
                    </label>
                    <input
                      type="url"
                      value={form.buttonUrl}
                      onChange={(e) => handleInputChange('buttonUrl', e.target.value)}
                      placeholder="https://startup.bihar.gov.in/"
                      className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-blue-600 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            </CardShell>

            {/* Official Recognition Certificate Upload */}
            <CardShell
              icon={FiFileText}
              title="Official Recognition Certificate"
              subtitle="Document shown when user clicks 'View Recognition Details'"
            >
              <div className="space-y-4">
                {/* Certificate Upload & Preview */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Recognition Certificate Document
                    </label>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      {form.certificateUrl ? 'Custom Certificate' : 'Default Certificate'}
                    </span>
                  </div>

                  {/* Visual Image Preview of Active Certificate */}
                  <div className="relative rounded-2xl overflow-hidden border border-emerald-200 bg-slate-900/5 mb-3 p-2.5 flex items-center justify-center">
                    <img
                      src={form.certificateUrl || form.imageUrl || defaultRecognitionImg}
                      alt="Certificate Preview"
                      className="max-h-48 w-auto object-contain rounded-xl shadow-sm"
                    />
                  </div>

                  {/* Direct Single Image Upload Control */}
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/70 rounded-xl text-xs font-bold text-emerald-800 transition-all cursor-pointer">
                      <FiUpload className="text-sm" />
                      <span>{uploadingCert ? 'Uploading...' : 'Upload Certificate (JPG/PNG)'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCertificateUpload}
                        disabled={uploadingCert}
                        className="hidden"
                      />
                    </label>

                    {form.certificateUrl && (
                      <button
                        type="button"
                        onClick={handleResetCertificate}
                        className="p-2.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl border border-red-200 transition-colors text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title="Reset to default official certificate"
                      >
                        <FiTrash2 className="text-sm" />
                        <span className="text-[11px]">Reset</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </CardShell>

            {/* Quick Live Preview Card in Admin (Matches exact layout, no arrows) */}
            <div className="rounded-3xl p-4 bg-gradient-to-r from-[#f4fcf6] via-[#ffffff] to-[#f0fbf4] border border-[#bbf7d0] shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <FiCheck className="text-emerald-600 stroke-[3]" /> Live Website Preview
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {form.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Banner Layout Preview */}
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <img
                    src={form.emblemUrl || '/bihar-seal-green.svg'}
                    alt="Bihar Seal"
                    className="w-12 h-auto object-contain shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    {form.badge && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-white bg-[#15803d] px-2 py-0.5 rounded-full mb-1">
                        <FiCheck className="text-[9px] stroke-[3]" />
                        {form.badge}
                      </span>
                    )}
                    <h4 className="text-xs font-extrabold text-[#0f172a] leading-tight">
                      {form.headingPrefix} <span className="text-[#0f172a]">{form.headingHighlight}</span>
                    </h4>
                    {form.description && (
                      <p className="text-[10px] text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                        {form.description}
                      </p>
                    )}
                    <div className="mt-1 text-[10px] font-bold text-[#15803d] flex items-center gap-1">
                      <span>{form.detailsLinkText || 'View Recognition Details'}</span>
                      <FiArrowRight className="text-[9px]" />
                    </div>
                  </div>
                </div>

                {/* Micro Highlights Preview */}
                {form.highlights && form.highlights.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 pt-1 border-t border-emerald-100/70">
                    {form.highlights.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="p-1.5 rounded-xl bg-white border border-[#e2f4e9] flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-[#eaf8ef] flex items-center justify-center shrink-0">
                          {renderIcon(item.iconType)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] font-bold text-slate-800 truncate">{item.title}</p>
                          <p className="text-[8px] text-slate-500 truncate">{item.subtitle}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Farmer Support Pill */}
                <div className="p-2.5 rounded-2xl bg-[#e8f7ee] border border-[#bbf0cb] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-white text-[#15803d] flex items-center justify-center shrink-0 shadow-2xs">
                      <FaHandshake className="text-xs" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#0f172a]">{form.tagline || "Supporting Bihar's Farmers"}</p>
                      <p className="text-[8px] text-slate-600">{form.taglineSub || 'With innovation, technology and commitment.'}</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold text-white bg-[#064e3b] px-2.5 py-1 rounded-full">
                    {form.buttonText || 'Explore More'} →
                  </span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </form>
    </div>
  );
};

export default StartupRecognitionAdmin;

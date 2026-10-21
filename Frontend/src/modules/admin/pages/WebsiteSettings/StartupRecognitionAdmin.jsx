import React, { useState, useEffect } from 'react';
import {
  FiAward,
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
  FiChevronLeft,
  FiChevronRight,
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import CardShell from '../../components/CardShell';
import API from '../../../../services/api';
import LogoLoader from '../../../../components/common/LogoLoader';
import { uploadToCloudinary } from '../../../../services/cloudinaryService';

const ICON_OPTIONS = [
  { value: 'award', label: 'Award', icon: FiAward },
  { value: 'shield', label: 'Shield', icon: FiShield },
  { value: 'trending', label: 'Trending', icon: FiTrendingUp },
  { value: 'check', label: 'Check Circle', icon: FiCheckCircle },
  { value: 'star', label: 'Star', icon: FiStar },
  { value: 'users', label: 'Users', icon: FiUsers },
];

const renderIcon = (type) => {
  switch (type) {
    case 'shield':
      return <FiShield className="text-emerald-500 text-lg" />;
    case 'trending':
      return <FiTrendingUp className="text-blue-500 text-lg" />;
    case 'check':
      return <FiCheckCircle className="text-green-500 text-lg" />;
    case 'star':
      return <FiStar className="text-yellow-500 text-lg" />;
    case 'users':
      return <FiUsers className="text-purple-500 text-lg" />;
    case 'award':
    default:
      return <FiAward className="text-amber-500 text-lg" />;
  }
};

const StartupRecognitionAdmin = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [previewSlideIndex, setPreviewSlideIndex] = useState(0);

  const [form, setForm] = useState({
    badge: '',
    headingPrefix: '',
    headingHighlight: '',
    tagline: '',
    description: '',
    buttonText: '',
    buttonUrl: '',
    portalTrustText: '',
    imageUrl: '',
    images: [],
    highlights: [],
    isActive: true,
  });

  useEffect(() => {
    fetchRecognition();
  }, []);

  const fetchRecognition = async () => {
    try {
      setLoading(true);
      const res = await API.get('/content/startup-recognition');
      if (res.data?.success && res.data?.data) {
        const data = res.data.data;
        // Normalize images array
        let initialImages = [];
        if (Array.isArray(data.images) && data.images.length > 0) {
          initialImages = data.images;
        } else if (data.imageUrl) {
          initialImages = [{ url: data.imageUrl, name: 'Default Image' }];
        }

        setForm((prev) => ({
          ...prev,
          ...data,
          images: initialImages,
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
    if (form.highlights.length >= 6) {
      toast.error('Maximum 6 highlights allowed');
      return;
    }
    setForm((prev) => ({
      ...prev,
      highlights: [
        ...prev.highlights,
        {
          title: 'New Recognition Highlight',
          subtitle: 'Policy / Government Support',
          iconType: 'award',
        },
      ],
    }));
  };

  const handleRemoveHighlight = (index) => {
    if (form.highlights.length <= 1) {
      toast.error('At least 1 highlight is required');
      return;
    }
    setForm((prev) => ({
      ...prev,
      highlights: prev.highlights.filter((_, i) => i !== index),
    }));
  };

  // Upload single or multiple images
  const handleMultipleImagesUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const validFiles = files.filter((f) => f.type.startsWith('image/'));
    if (validFiles.length === 0) {
      toast.error('Please select valid image files');
      return;
    }

    try {
      setUploadingImages(true);
      const loadingToast = toast.loading(`Uploading ${validFiles.length} image(s)...`);

      const uploadPromises = validFiles.map(async (file) => {
        try {
          const formData = new FormData();
          formData.append('file', file);
          const res = await API.post('/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          if (res.data?.success && res.data?.imageUrl) {
            return { url: res.data.imageUrl, name: file.name };
          }
        } catch (backendErr) {
          // fallback
        }
        const fallbackUrl = await uploadToCloudinary(file);
        return { url: fallbackUrl, name: file.name };
      });

      const uploadedResults = await Promise.all(uploadPromises);
      const newImages = uploadedResults.filter((img) => img && img.url);

      setForm((prev) => {
        const combined = [...(prev.images || []), ...newImages];
        return {
          ...prev,
          images: combined,
          imageUrl: combined[0]?.url || prev.imageUrl,
        };
      });

      toast.dismiss(loadingToast);
      toast.success(`${newImages.length} image(s) uploaded successfully!`);
    } catch (err) {
      console.error('Upload failed:', err);
      toast.error('Failed to upload image(s)');
    } finally {
      setUploadingImages(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = (index) => {
    setForm((prev) => {
      const updated = prev.images.filter((_, i) => i !== index);
      return {
        ...prev,
        images: updated,
        imageUrl: updated[0]?.url || '',
      };
    });
    if (previewSlideIndex >= form.images.length - 1) {
      setPreviewSlideIndex(Math.max(0, form.images.length - 2));
    }
    toast.success('Image removed');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        ...form,
        imageUrl: form.images[0]?.url || form.imageUrl || '',
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

  // Preview slideshow interval
  useEffect(() => {
    if (!form.images || form.images.length <= 1) return;
    const interval = setInterval(() => {
      setPreviewSlideIndex((prev) => (prev + 1) % form.images.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [form.images]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LogoLoader />
      </div>
    );
  }

  const activePreviewImage =
    form.images && form.images.length > 0
      ? form.images[previewSlideIndex % form.images.length]?.url
      : form.imageUrl || '';

  return (
    <div className="space-y-6">
      {/* Top Header & Save Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-600">
              <FiAward className="text-2xl" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">
                Startup Recognition & Ecosystem Support
              </h1>
              <p className="text-xs md:text-sm text-gray-500 mt-0.5">
                Manage recognition details, credentials, highlights, and sliding showcase images.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Active Status Badge Button */}
          <button
            type="button"
            onClick={() => handleInputChange('isActive', !form.isActive)}
            className={`inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
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
          
          {/* Left Column: Form Fields */}
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
                    placeholder="e.g. STARTUP RECOGNITION & ECOSYSTEM SUPPORT"
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
                      placeholder="e.g. Selected Under"
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
                      className="w-full px-3.5 py-2 text-sm border border-amber-300 bg-amber-50/40 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none font-semibold text-amber-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Supporting Tagline
                  </label>
                  <input
                    type="text"
                    value={form.tagline}
                    onChange={(e) => handleInputChange('tagline', e.target.value)}
                    placeholder="e.g. Building India’s Rural Agri Services Infrastructure."
                    className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Detailed Narrative Description
                  </label>
                  <textarea
                    rows={4}
                    value={form.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Describe the recognition, government initiative, and startup mission..."
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none leading-relaxed"
                  />
                  <div className="text-right text-[11px] text-gray-400 mt-1">
                    {form.description.length} characters
                  </div>
                </div>
              </div>
            </CardShell>

            {/* Action Button & Link Card */}
            <CardShell
              icon={FiExternalLink}
              title="Call To Action Button & Verification Portal"
              subtitle="Official Link & Trust Tag"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Button Label
                  </label>
                  <input
                    type="text"
                    value={form.buttonText}
                    onChange={(e) => handleInputChange('buttonText', e.target.value)}
                    placeholder="e.g. Explore Startup Bihar"
                    className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    External Target URL
                  </label>
                  <input
                    type="url"
                    value={form.buttonUrl}
                    onChange={(e) => handleInputChange('buttonUrl', e.target.value)}
                    placeholder="https://startup.bihar.gov.in/"
                    className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-blue-600 font-mono text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Portal Trust Badge Text
                  </label>
                  <input
                    type="text"
                    value={form.portalTrustText}
                    onChange={(e) => handleInputChange('portalTrustText', e.target.value)}
                    placeholder="e.g. Official Government of Bihar Portal"
                    className="w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  />
                </div>
              </div>
            </CardShell>

            {/* Highlights Pillars Card */}
            <CardShell
              icon={FiShield}
              title="Impact Highlights & Ecosystem Pillars"
              subtitle="Highlight Cards Shown Below Narrative"
            >
              <div className="space-y-3.5">
                {form.highlights.map((item, idx) => (
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
                        className="text-xs border border-gray-300 rounded-md px-2 py-1.5 bg-gray-50 outline-none font-medium"
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
                        placeholder="Highlight Title"
                        className="w-full px-3 py-1.5 text-xs font-bold border border-gray-300 rounded-md outline-none focus:ring-1 focus:ring-green-500"
                      />
                      <input
                        type="text"
                        value={item.subtitle}
                        onChange={(e) => handleHighlightChange(idx, 'subtitle', e.target.value)}
                        placeholder="Subtitle / Authority"
                        className="w-full px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-md outline-none focus:ring-1 focus:ring-green-500"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveHighlight(idx)}
                      className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                      title="Remove highlight"
                    >
                      <FiTrash2 className="text-sm" />
                    </button>
                  </div>
                ))}

                {form.highlights.length < 6 && (
                  <button
                    type="button"
                    onClick={handleAddHighlight}
                    className="w-full py-2.5 border-2 border-dashed border-gray-300 hover:border-green-500 rounded-xl text-xs font-bold text-gray-600 hover:text-green-600 transition-colors flex items-center justify-center gap-1.5 bg-gray-50/50 hover:bg-green-50/30"
                  >
                    <FiPlus className="text-sm" />
                    <span>Add Another Highlight Card</span>
                  </button>
                )}
              </div>
            </CardShell>

          </div>

          {/* Right Column: Visual Showcase & Multi-Image Gallery */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Multi-Image Gallery Card */}
            <CardShell
              icon={FiImage}
              title="Recognition Showcase Images (Slider)"
              subtitle="Upload multiple images to display as a carousel slider on the homepage"
            >
              <div className="space-y-4">
                
                {/* Upload Button Area */}
                <div>
                  <label className="cursor-pointer flex flex-col items-center justify-center p-6 border-2 border-dashed border-emerald-400/60 hover:border-emerald-500 bg-emerald-50/20 hover:bg-emerald-50/40 rounded-2xl transition-all group">
                    <div className="p-3 bg-emerald-100/70 text-emerald-700 rounded-full mb-2 group-hover:scale-110 transition-transform">
                      <FiUpload className="text-xl" />
                    </div>
                    <span className="text-sm font-bold text-gray-800">
                      {uploadingImages ? 'Uploading Images...' : '+ Upload Images'}
                    </span>
                    <span className="text-[11px] text-gray-500 mt-1">
                      Select one or multiple images (PNG, JPG, WebP)
                    </span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleMultipleImagesUpload}
                      disabled={uploadingImages}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Uploaded Images List / Grid */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Uploaded Slides ({form.images?.length || 0})
                    </span>
                    {form.images?.length > 1 && (
                      <span className="text-[11px] text-emerald-600 font-semibold">
                        Slides auto-play on website
                      </span>
                    )}
                  </div>

                  {form.images && form.images.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {form.images.map((img, idx) => (
                        <div
                          key={idx}
                          className="relative group rounded-xl overflow-hidden border border-gray-200 aspect-[4/3] bg-slate-900 shadow-sm"
                        >
                          <img
                            src={img.url}
                            alt={`Slide ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm">
                            #{idx + 1}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="absolute top-1.5 right-1.5 p-1.5 bg-red-600/90 text-white rounded-lg opacity-90 group-hover:opacity-100 hover:bg-red-700 transition-all shadow"
                            title="Delete image"
                          >
                            <FiTrash2 className="text-xs" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-center text-xs text-gray-500">
                      No images uploaded yet. Click "+ Upload Images" above to add slides.
                    </div>
                  )}
                </div>

              </div>
            </CardShell>

            {/* Quick Live Preview Card in Admin with Slider */}
            <div className="rounded-2xl p-5 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white border border-emerald-500/30 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  Live Preview on Website
                </span>
                <span className="text-[10px] text-gray-400">
                  {form.isActive ? '● Active' : '○ Inactive'}
                </span>
              </div>

              {/* Slider Preview Box */}
              <div className="relative rounded-xl overflow-hidden border border-emerald-400/30 bg-slate-900 aspect-[4/3] shadow-inner">
                {activePreviewImage ? (
                  <img
                    src={activePreviewImage}
                    alt="Slide preview"
                    className="w-full h-full object-cover transition-all duration-700"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4 text-center">
                    <FiImage className="text-3xl mb-1 opacity-50" />
                    <span className="text-xs">No Image Slide</span>
                  </div>
                )}

                {/* Slide indicator dots */}
                {form.images && form.images.length > 1 && (
                  <div className="absolute bottom-2.5 inset-x-0 flex justify-center items-center gap-1.5 z-10">
                    {form.images.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setPreviewSlideIndex(i)}
                        className={`h-1.5 rounded-full transition-all ${
                          i === previewSlideIndex % form.images.length
                            ? 'w-5 bg-emerald-400'
                            : 'w-1.5 bg-white/40'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div>
                {form.badge && (
                  <span className="inline-block text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 mb-2">
                    {form.badge}
                  </span>
                )}
                <h3 className="text-lg font-black text-white leading-tight">
                  {form.headingPrefix}{' '}
                  <span className="bg-gradient-to-r from-yellow-300 to-emerald-400 bg-clip-text text-transparent">
                    {form.headingHighlight}
                  </span>
                </h3>
                {form.tagline && (
                  <p className="text-xs text-emerald-300/90 italic font-semibold mt-1">
                    {form.tagline}
                  </p>
                )}
                {form.description && (
                  <p className="text-xs text-slate-300 mt-2 line-clamp-3 leading-relaxed">
                    {form.description}
                  </p>
                )}
              </div>

              {form.buttonText && (
                <div className="pt-1">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 px-3.5 py-1.5 rounded-full">
                    <span>{form.buttonText}</span>
                    <FiExternalLink className="text-[11px]" />
                  </span>
                </div>
              )}
            </div>

          </div>

        </div>
      </form>
    </div>
  );
};

export default StartupRecognitionAdmin;

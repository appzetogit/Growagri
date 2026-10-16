import React, { useState, useEffect } from "react";
import { 
  FiPlus, 
  FiTrash2, 
  FiImage, 
  FiUpload, 
  FiCheckCircle, 
  FiEye, 
  FiEyeOff,
  FiLayers,
  FiRefreshCw
} from "react-icons/fi";
import { toast } from "react-hot-toast";
import CardShell from "../../components/CardShell";
import Modal from "../../components/Modal";
import websiteService from "../../services/websiteService";
import LogoLoader from "../../../../components/common/LogoLoader";
import API from "../../../../services/api";

const Banners = () => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const res = await websiteService.getBanners();
      if (res.data.success) {
        setBanners(res.data.data);
      }
    } catch (error) {
      toast.error("Failed to load banners");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (banner = null) => {
    if (banner) {
      setEditingId(banner._id);
      setImageUrl(banner.imageUrl || "");
    } else {
      setEditingId(null);
      setImageUrl("");
    }
    setIsModalOpen(true);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    try {
      setUploading(true);
      const res = await API.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        setImageUrl(res.data.imageUrl);
        toast.success("Banner image uploaded!");
      }
    } catch (error) {
      toast.error("Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!imageUrl) {
      toast.error("Please upload a banner image");
      return;
    }

    const data = {
      imageUrl,
      title: "Banner",
      isActive: true
    };

    try {
      if (editingId) {
        const res = await websiteService.updateBanner(editingId, { imageUrl });
        if (res.data.success) {
          toast.success("Website banner updated");
          fetchBanners();
          setIsModalOpen(false);
        }
      } else {
        const res = await websiteService.createBanner(data);
        if (res.data.success) {
          toast.success("Website banner uploaded successfully");
          fetchBanners();
          setIsModalOpen(false);
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Error saving banner");
    }
  };

  const handleToggleStatus = async (banner) => {
    try {
      const res = await websiteService.updateBanner(banner._id, { isActive: !banner.isActive });
      if (res.data.success) {
        toast.success(`Banner is now ${!banner.isActive ? 'Active' : 'Hidden'}`);
        setBanners(prev => prev.map(b => b._id === banner._id ? { ...b, isActive: !b.isActive } : b));
      }
    } catch (error) {
      toast.error("Failed to toggle banner status");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this website banner?")) return;
    try {
      const res = await websiteService.deleteBanner(id);
      if (res.data.success) {
        toast.success("Banner deleted");
        fetchBanners();
      }
    } catch (error) {
      toast.error("Delete failed");
    }
  };

  if (loading) return <LogoLoader />;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-xs">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <FiImage className="text-emerald-600" />
            Website Banners
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Upload banner images to display in the homepage hero section.
          </p>
        </div>
        <button 
          onClick={() => handleOpenModal()} 
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl font-bold shadow-md hover:from-emerald-700 hover:to-green-700 transition-all hover:shadow-lg active:scale-95"
        >
          <FiPlus size={18} /> Upload Banner
        </button>
      </div>

      {/* Banners Grid / List */}
      <CardShell icon={FiLayers}>
        {banners.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
              <FiImage size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">No Website Banners Uploaded</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
              Upload your banner images here. They will automatically rotate on the homepage hero section.
            </p>
            <button
              onClick={() => handleOpenModal()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold shadow hover:bg-emerald-700 transition-all"
            >
              <FiPlus /> Upload First Banner
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
            {banners.map((item, idx) => (
              <div 
                key={item._id} 
                className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 flex flex-col group"
              >
                {/* Banner Image Preview */}
                <div className="relative aspect-video w-full bg-gray-100 overflow-hidden">
                  <img 
                    src={item.imageUrl} 
                    alt={`Banner ${idx + 1}`} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                  />
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold shadow-xs ${
                      item.isActive ? 'bg-emerald-500 text-white' : 'bg-gray-500 text-white'
                    }`}>
                      {item.isActive ? 'Active' : 'Hidden'}
                    </span>
                  </div>
                  <div className="absolute bottom-2 left-3 bg-black/60 backdrop-blur-sm text-white px-2.5 py-0.5 rounded-md text-xs font-semibold">
                    Banner #{idx + 1}
                  </div>
                </div>

                {/* Banner Actions Bar */}
                <div className="p-4 flex items-center justify-between border-t border-gray-100 mt-auto bg-gray-50/50">
                  <button
                    onClick={() => handleToggleStatus(item)}
                    title={item.isActive ? "Hide from website" : "Show on website"}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      item.isActive 
                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {item.isActive ? (
                      <>
                        <FiEye size={13} /> Active
                      </>
                    ) : (
                      <>
                        <FiEyeOff size={13} /> Hidden
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleOpenModal(item)} 
                      className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Replace Banner Image"
                    >
                      <FiRefreshCw size={15} />
                    </button>
                    <button 
                      onClick={() => handleDelete(item._id)} 
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Banner"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardShell>

      {/* Upload Banner Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingId ? "Change Banner Image" : "Upload Website Banner"}
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Banner Upload Area */}
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">
              Banner Image *
            </label>

            {/* Preview if uploaded */}
            {imageUrl ? (
              <div className="space-y-3">
                <div className="relative group rounded-2xl overflow-hidden border-2 border-emerald-500 bg-black aspect-video w-full shadow-lg">
                  <img src={imageUrl} className="w-full h-full object-cover" alt="Banner Preview" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <label className="px-4 py-2 bg-white text-gray-800 rounded-xl font-bold text-xs cursor-pointer hover:bg-gray-100 shadow transition-all">
                      Change Image
                      <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={uploading} />
                    </label>
                    <button 
                      type="button" 
                      onClick={() => setImageUrl("")}
                      className="bg-red-500 text-white rounded-xl px-4 py-2 text-xs font-bold shadow hover:bg-red-600 transition-all flex items-center gap-1.5"
                    >
                      <FiTrash2 size={14} /> Remove
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold">
                  <FiCheckCircle size={14} /> Banner ready to publish
                </div>
              </div>
            ) : (
              /* Drag & Drop / Click Upload Box */
              <label className="flex flex-col items-center justify-center w-full aspect-video border-2 border-dashed border-gray-300 hover:border-emerald-500 rounded-2xl cursor-pointer bg-gray-50/70 hover:bg-emerald-50/30 transition-all p-6 text-center group">
                <div className="w-14 h-14 bg-emerald-100 group-hover:bg-emerald-200 rounded-full flex items-center justify-center text-emerald-700 mb-3 transition-colors">
                  <FiUpload size={24} />
                </div>
                <span className="text-sm font-bold text-gray-800 mb-1">
                  {uploading ? 'Uploading Image...' : 'Click to Upload Banner Image'}
                </span>
                <span className="text-xs text-gray-400">
                  PNG, JPG, WEBP recommended (16:9 or 16:10 aspect ratio)
                </span>
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleFileUpload} 
                  disabled={uploading} 
                />
              </label>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button 
              type="button" 
              onClick={() => setIsModalOpen(false)} 
              className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors text-sm"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={uploading || !imageUrl} 
              className="px-7 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl font-bold shadow-md hover:from-emerald-700 hover:to-green-700 transition-all disabled:opacity-50 text-sm"
            >
              {editingId ? "Update Banner" : "Upload Banner"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Banners;

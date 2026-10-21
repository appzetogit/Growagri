import React, { useState, useEffect } from "react";
import { FiSave, FiInfo, FiImage, FiX } from "react-icons/fi";
import { toast } from "react-hot-toast";
import CardShell from "../../components/CardShell";
import API from "../../../../services/api";
import LogoLoader from "../../../../components/common/LogoLoader";
import { uploadToCloudinary } from "../../../../services/cloudinaryService";

const AboutUs = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    title: "About GROO",
    content: "",
    images: []
  });

  useEffect(() => {
    fetchAbout();
  }, []);

  const fetchAbout = async () => {
    try {
      setLoading(true);
      const res = await API.get('/content/about');
      if (res.data.success && res.data.data) {
        setForm({
          title: res.data.data.title || "About GROO",
          content: res.data.data.content || "",
          images: res.data.data.images || []
        });
      }
    } catch (error) {
      toast.error("Failed to load About Us content");
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (form.images.length >= 4) {
      toast.error("Maximum 4 images allowed. Please remove an image first.");
      e.target.value = "";
      return;
    }

    const availableSlots = 4 - form.images.length;
    const filesToUpload = files.slice(0, availableSlots);

    if (files.length > availableSlots) {
      toast.error(`Only ${availableSlots} more image(s) allowed (Max 4). Extra images ignored.`);
    }

    try {
      const loadingToast = toast.loading(`Uploading ${filesToUpload.length} image(s)...`);
      const uploadPromises = filesToUpload.map(file => uploadToCloudinary(file));
      const urls = await Promise.all(uploadPromises);
      
      const newImages = urls.map(url => ({ url, name: "" }));
      
      setForm(prev => ({ 
        ...prev, 
        images: [...prev.images, ...newImages].slice(0, 4)
      }));
      
      toast.dismiss(loadingToast);
      toast.success("Images uploaded!");
    } catch (error) {
      toast.error("Failed to upload images");
    } finally {
      e.target.value = "";
    }
  };

  const removeImage = (index) => {
    setForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await API.put('/content/about', form);
      if (res.data.success) {
        toast.success("About Us content updated");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Error saving content");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LogoLoader />;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Manage About Us</h2>
      </div>

      <CardShell icon={FiInfo}>
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
          <div className="bg-green-50 p-4 rounded-lg text-green-800 text-sm flex gap-3 border border-green-100">
             <FiInfo className="shrink-0 mt-0.5 text-green-600" size={18} />
             <p>Write your "About Us" content below. Simply use the <b>Enter</b> key to start new paragraphs. No need to use any HTML tags.</p>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Section Title</label>
            <input 
              required 
              type="text" 
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" 
              value={form.title} 
              onChange={e => setForm({...form, title: e.target.value})} 
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Content (Description)</label>
            <textarea 
              required 
              rows="10" 
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none leading-relaxed" 
              value={form.content} 
              onChange={e => setForm({...form, content: e.target.value})} 
              placeholder="Write your company information here..."
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-bold">Featured Images (About Section)</label>
              <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {form.images.length}/4 Images
              </span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {form.images.map((img, index) => (
                <div key={index} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 group shadow-sm bg-gray-50">
                  <img src={img.url} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                  <button 
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    title="Remove image"
                  >
                    <FiX size={14} />
                  </button>
                </div>
              ))}
              
              {form.images.length < 4 && (
                <label className="flex flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer group shadow-sm">
                  <FiImage className="w-8 h-8 mb-1 text-gray-400 group-hover:text-primary-500 transition-colors" />
                  <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Add Image</span>
                  <input type="file" className="hidden" accept="image/*" multiple onChange={handleImageChange} />
                </label>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-3">These images will appear on the homepage About section (Maximum 4 images).</p>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <button 
              type="submit" 
              disabled={saving}
              className="px-8 py-3 bg-primary-600 text-white rounded-lg font-bold shadow-md hover:bg-primary-700 flex items-center gap-2 disabled:bg-primary-400"
            >
              <FiSave /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </CardShell>
    </div>
  );
};

export default AboutUs;

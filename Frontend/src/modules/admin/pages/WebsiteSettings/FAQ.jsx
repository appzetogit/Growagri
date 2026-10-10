import React, { useState, useEffect } from "react";
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiHelpCircle } from "react-icons/fi";
import { toast } from "react-hot-toast";
import CardShell from "../../components/CardShell";
import Modal from "../../components/Modal";
import API from "../../../../services/api";
import LogoLoader from "../../../../components/common/LogoLoader";

const FAQ = () => {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [form, setForm] = useState({
    question: "",
    answer: "",
    category: "General",
    isActive: true
  });

  const categories = ['Farmer', 'Owner', 'General'];

  useEffect(() => {
    fetchFaqs();
  }, []);

  const fetchFaqs = async () => {
    try {
      setLoading(true);
      const res = await API.get('/content/faq/all');
      if (res.data.success) {
        setFaqs(res.data.data);
      }
    } catch (error) {
      toast.error("Failed to load FAQs");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (faq = null) => {
    if (faq) {
      setEditingId(faq._id);
      setForm({
        question: faq.question || "",
        answer: faq.answer || "",
        category: faq.category || "General",
        isActive: faq.isActive ?? true
      });
    } else {
      setEditingId(null);
      setForm({
        question: "",
        answer: "",
        category: "General",
        isActive: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        const res = await API.put(`/content/faq/${editingId}`, form);
        if (res.data.success) {
          toast.success("FAQ updated");
          fetchFaqs();
          setIsModalOpen(false);
        }
      } else {
        const res = await API.post('/content/faq', form);
        if (res.data.success) {
          toast.success("FAQ created");
          fetchFaqs();
          setIsModalOpen(false);
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Error saving FAQ");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this FAQ?")) return;
    try {
      const res = await API.delete(`/content/faq/${id}`);
      if (res.data.success) {
        toast.success("FAQ deleted");
        fetchFaqs();
      }
    } catch (error) {
      toast.error("Delete failed");
    }
  };

  const filteredItems = faqs.filter(f => f.question.toLowerCase().includes(searchTerm.trim().toLowerCase()));

  if (loading) return <LogoLoader />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Manage FAQs</h2>
        <button onClick={() => handleOpenModal()} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
          <FiPlus /> Add FAQ
        </button>
      </div>

      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search questions..."
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <CardShell icon={FiHelpCircle}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left">Question</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredItems.map(item => (
                <tr key={item._id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-semibold max-w-xs truncate">{item.question}</td>
                  <td className="px-4 py-3">{item.category}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${item.isActive ? 'bg-green-100 text-green-600':'bg-red-100 text-red-600'}`}>
                        {item.isActive ? 'Active' : 'Hidden'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => handleOpenModal(item)} className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"><FiEdit2 /></button>
                      <button onClick={() => handleDelete(item._id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><FiTrash2 /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                 <tr>
                    <td colSpan="4" className="text-center py-6 text-gray-500">No FAQs found.</td>
                 </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardShell>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Edit FAQ" : "Add FAQ"}>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold mb-1">Question</label>
            <input required type="text" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" value={form.question} onChange={e => setForm({...form, question: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Answer</label>
            <textarea required rows="4" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" value={form.answer} onChange={e => setForm({...form, answer: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Category</label>
            <select className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="faq-active" checked={form.isActive} onChange={e => setForm({...form, isActive: e.target.checked})} />
            <label htmlFor="faq-active" className="text-sm font-semibold">Active</label>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 bg-gray-100 rounded-lg font-semibold hover:bg-gray-200">Cancel</button>
            <button type="submit" className="px-6 py-2 bg-primary-600 text-white rounded-lg font-bold shadow-md hover:bg-primary-700">Save</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default FAQ;

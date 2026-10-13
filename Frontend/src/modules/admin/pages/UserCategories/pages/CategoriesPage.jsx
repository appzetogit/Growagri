import React, { useEffect, useMemo, useState } from "react";
import { FiGrid, FiPlus, FiEdit2, FiTrash2, FiSave, FiChevronUp, FiChevronDown, FiMove, FiX, FiSearch } from "react-icons/fi";
import { toast } from "react-hot-toast";
import CardShell from "../components/CardShell";
import Modal from "../components/Modal";
import { saveCatalog, slugify, toAssetUrl } from "../utils";

import { categoryService, serviceService, homeContentService } from "../../../../../services/catalogService";
import { z } from "zod";

const categorySchema = z.object({
  sectionType: z.string().min(1, "Please select a Home Page Tab Section"),
  title: z.string().trim().min(2, "Category title must be at least 2 characters"),
  homeIconUrl: z.string().min(1, "Please upload a home / profile icon"),
  hourlyPrice: z.coerce.number({ invalid_type_error: "Please enter a valid hourly price" }).min(1, "1 Hour price must be greater than 0"),
  slug: z.string().optional(),
  homeBadge: z.string().optional(),
  hasSaleBadge: z.boolean().optional(),
  showOnHome: z.boolean().optional(),
  parentCategory: z.string().nullable().optional(),
  parentCategories: z.array(z.string()).optional(),
  isAlwaysMain: z.boolean().default(false),
  requiresDriver: z.boolean().default(false),
  trackingType: z.string().default('none'),
});

const CategoriesPage = ({ catalog, setCatalog, selectedCity }) => {
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [premiumOfferings, setPremiumOfferings] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

  const [form, setForm] = useState({
    title: "",
    slug: "",
    homeIconUrl: "",
    homeBadge: "",
    hasSaleBadge: false,
    showOnHome: true,
    parentCategory: "",
    parentCategories: [],
    isAlwaysMain: false,
    trackingType: "none",
    requiresDriver: false,
    sectionType: "",
    hourlyPrice: "",
  });

  const categoriesBase = useMemo(() => {
    return [...(catalog.categories || [])].sort((a, b) => (a.homeOrder || 0) - (b.homeOrder || 0));
  }, [catalog.categories]);

  const getCategoryId = (value) => {
    if (!value) return null;
    if (typeof value === "string") return value;
    if (typeof value === "object") return (value.id || value._id || null)?.toString?.() || null;
    return value?.toString?.() || null;
  };

  const getCategoryTitle = (value) => {
    if (!value) return "";
    if (typeof value === "object" && value.title) return value.title;
    const id = getCategoryId(value);
    return categoriesBase.find(cat => cat.id === id)?.title || "";
  };

  const categoriesFiltered = useMemo(() => {
    if (!searchTerm) return categoriesBase;
    const lower = searchTerm.trim().toLowerCase();
    return categoriesBase.filter(c =>
      c.title?.toLowerCase().includes(lower) ||
      c.slug?.toLowerCase().includes(lower)
    );
  }, [categoriesBase, searchTerm]);

  const editing = useMemo(() => categoriesBase.find((c) => c.id === editingId) || null, [categoriesBase, editingId]);

  const fetchCategories = async () => {
    try {
      setFetching(true);
      setSelectedIds([]);
      const params = { status: 'active' };
      if (selectedCity) params.cityId = selectedCity;

      const response = await categoryService.getAll(params);

      if (response.success && response.categories) {
        const mapped = response.categories.map(cat => ({
          id: (cat.id || cat._id?.$oid || cat._id)?.toString() || "",
          title: cat.title,
          slug: cat.slug,
          homeIconUrl: cat.homeIconUrl || "",
          homeBadge: cat.homeBadge || "",
          hasSaleBadge: cat.hasSaleBadge || false,
          showOnHome: cat.showOnHome !== false,
          homeOrder: cat.homeOrder || 0,
          parentCategory: getCategoryId(cat.parentCategory),
          parentCategories: Array.isArray(cat.parentCategories)
            ? cat.parentCategories
              .map(parent => ({
                id: getCategoryId(parent),
                title: getCategoryTitle(parent),
              }))
              .filter(parent => parent.id)
            : [],
          isAlwaysMain: !!cat.isAlwaysMain,
          trackingType: cat.trackingType || 'none',
          requiresDriver: cat.requiresDriver || false,
          sectionType: cat.sectionType || '',
          hourlyPrice: cat.hourlyPrice !== undefined && cat.hourlyPrice !== null ? cat.hourlyPrice : 0,
        }));

        setCatalog({ ...catalog, categories: mapped });
        saveCatalog({ ...catalog, categories: mapped });
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      toast.error('Failed to load categories');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchCategories();

    const fetchHomeData = async () => {
      try {
        const response = await homeContentService.get({ cityId: selectedCity });
        if (response.success && response.homeContent) {
           setPremiumOfferings(response.homeContent.premiumOfferings || []);
        }
      } catch (e) {}
    };
    fetchHomeData();
  }, [selectedCity]);

  useEffect(() => {
    if (!editing) {
      setForm({
        title: "", slug: "", homeIconUrl: "", homeBadge: "",
        hasSaleBadge: false, showOnHome: true, parentCategory: "",
        parentCategories: [], isAlwaysMain: false,
        trackingType: "none", requiresDriver: false,
        sectionType: "", hourlyPrice: "",
      });
      return;
    }
    setForm({
      title: editing.title || "",
      slug: editing.slug || "",
      homeIconUrl: editing.homeIconUrl || "",
      homeBadge: editing.homeBadge || "",
      hasSaleBadge: Boolean(editing.hasSaleBadge),
      showOnHome: editing.showOnHome !== false,
      parentCategory: editing.parentCategory || "",
      parentCategories: Array.isArray(editing.parentCategories)
        ? editing.parentCategories.map(parent => getCategoryId(parent)).filter(Boolean)
        : [],
      isAlwaysMain: !!editing.isAlwaysMain,
      trackingType: editing.trackingType || "none",
      requiresDriver: Boolean(editing.requiresDriver),
      sectionType: editing.sectionType || "",
      hourlyPrice: editing.hourlyPrice !== undefined && editing.hourlyPrice !== null ? editing.hourlyPrice : "",
    });
  }, [editingId, editing]);

  const reset = () => {
    setEditingId(null);
    setForm({
      title: "", slug: "", homeIconUrl: "", homeBadge: "",
      hasSaleBadge: false, showOnHome: true, parentCategory: "",
      parentCategories: [], isAlwaysMain: false,
      trackingType: "none", requiresDriver: false,
      sectionType: "", hourlyPrice: "",
    });
    setIsModalOpen(false);
  };

  const normalizeCategory = (cat) => ({
    id: (cat.id || cat._id?.$oid || cat._id)?.toString() || "",
    title: cat.title,
    slug: cat.slug,
    homeIconUrl: cat.homeIconUrl || "",
    homeBadge: cat.homeBadge || "",
    hasSaleBadge: cat.hasSaleBadge || false,
    showOnHome: cat.showOnHome !== false,
    homeOrder: cat.homeOrder || 0,
    parentCategory: getCategoryId(cat.parentCategory),
    parentCategories: Array.isArray(cat.parentCategories)
      ? cat.parentCategories
        .map(parent => ({
          id: getCategoryId(parent),
          title: getCategoryTitle(parent),
        }))
        .filter(parent => parent.id)
      : [],
    isAlwaysMain: !!cat.isAlwaysMain,
    trackingType: cat.trackingType || 'none',
    requiresDriver: cat.requiresDriver || false,
    sectionType: cat.sectionType || '',
    hourlyPrice: cat.hourlyPrice !== undefined && cat.hourlyPrice !== null ? cat.hourlyPrice : 0,
  });

  const upsert = async () => {
    const val = categorySchema.safeParse({
      ...form,
      title: form.title.trim(),
      slug: slugify(form.title.trim()),
      hourlyPrice: form.hourlyPrice === "" ? undefined : Number(form.hourlyPrice),
    });

    if (!val.success) {
      toast.error(val.error.issues[0].message);
      return;
    }

    try {
      setLoading(true);
      const data = {
        ...val.data,
        parentCategories: form.parentCategories || [],
        cityIds: selectedCity ? [selectedCity] : [],
        homeOrder: editing?.homeOrder || 0
      };

      if (!editing) {
        const maxOrder = Math.max(...categoriesBase.map(c => c.homeOrder || 0), 0);
        data.homeOrder = maxOrder + 1;
      }

      const response = editing
        ? await categoryService.update(editingId, data)
        : await categoryService.create(data);

      if (response.success) {
        if (response.category) {
          const normalizedCategory = normalizeCategory(response.category);
          const existingCategories = catalog.categories || [];
          const updatedCategories = editing
            ? existingCategories.map(category =>
              category.id === normalizedCategory.id ? normalizedCategory : category
            )
            : [...existingCategories, normalizedCategory];

          const nextCatalog = { ...catalog, categories: updatedCategories };
          setCatalog(nextCatalog);
          saveCatalog(nextCatalog);
        }

        toast.success(editing ? "Category updated" : "Category created");
        fetchCategories();
        reset();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save category");
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this category?")) return;
    try {
      setLoading(true);
      const res = await categoryService.delete(id);
      if (res.success) {
        toast.success("Deleted");
        setSelectedIds(prev => prev.filter(item => item !== id));
        fetchCategories();
      }
    } catch (error) {
      toast.error("Delete failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(categoriesFiltered.map(c => c.id).filter(Boolean));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} selected categor${selectedIds.length === 1 ? 'y' : 'ies'}?`)) return;
    
    try {
      setLoading(true);
      let successCount = 0;
      let failCount = 0;

      for (const id of selectedIds) {
        try {
          const res = await categoryService.delete(id);
          if (res.success) successCount++;
          else failCount++;
        } catch (err) {
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} categor${successCount === 1 ? 'y' : 'ies'} deleted successfully`);
        setSelectedIds([]);
        fetchCategories();
      }
      if (failCount > 0) {
        toast.error(`Failed to delete ${failCount} categor${failCount === 1 ? 'y' : 'ies'} (check if they have active bookings)`);
      }
    } catch (error) {
      toast.error("Bulk delete failed");
    } finally {
      setLoading(false);
    }
  };

  const moveOrder = async (id, newOrder) => {
    try {
      await categoryService.updateOrder(id, newOrder);
      fetchCategories();
    } catch (e) { toast.error("Move failed"); }
  };

  const handleDragStart = (e, index) => { setDraggedItem(index); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === dropIndex) return;
    const newItems = [...categoriesFiltered];
    const [moved] = newItems.splice(draggedItem, 1);
    newItems.splice(dropIndex, 0, moved);

    try {
      await Promise.all(newItems.map((c, i) => categoryService.updateOrder(c.id, i)));
      fetchCategories();
      toast.success("Order saved");
    } catch (err) { toast.error("Save failed"); }
    setDraggedItem(null);
  };

  if (fetching) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-sm border border-slate-100 min-h-[400px]">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-bold text-lg animate-pulse">Loading Categories...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CardShell icon={FiGrid}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600 font-bold uppercase tracking-tight">{categoriesFiltered.length} Items</div>
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl animate-in fade-in duration-150">
                <span className="text-xs font-black text-rose-700">{selectedIds.length} Selected</span>
                <button
                  onClick={handleBulkDelete}
                  disabled={loading}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-black flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <FiTrash2 className="w-3.5 h-3.5" /> Delete Selected ({selectedIds.length})
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text" placeholder="Search..." value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              />
            </div>
            <button
              onClick={() => { reset(); setIsModalOpen(true); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm hover:bg-blue-700 transition-colors"
            >
              <FiPlus /> Add Category
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200 bg-gray-50/50">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                    checked={categoriesFiltered.length > 0 && categoriesFiltered.every(c => selectedIds.includes(c.id))}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="text-left py-3 px-4 text-xs font-black text-gray-400 uppercase tracking-widest w-12">#</th>
                <th className="text-left py-3 px-4 text-xs font-black text-gray-400 uppercase tracking-widest w-20">Icon</th>
                <th className="text-left py-3 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">Category Name</th>
                <th className="text-left py-3 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">Parent Category</th>
                <th className="text-left py-3 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">1 Hr Rate</th>
                <th className="text-left py-3 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">Hierarchy</th>
                <th className="text-center py-3 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categoriesFiltered.map((c, idx) => {
                const parents = Array.isArray(c.parentCategories)
                  ? c.parentCategories
                    .map(parent => ({
                      id: getCategoryId(parent),
                      title: getCategoryTitle(parent),
                    }))
                    .filter(parent => parent.id)
                  : [];
                const isSub = parents.length > 0;
                const children = categoriesBase.filter(child =>
                  Array.isArray(child.parentCategories) &&
                  child.parentCategories.some(parent => getCategoryId(parent) === c.id)
                );
                const isSelected = selectedIds.includes(c.id);
                return (
                  <tr key={c.id} className={`hover:bg-blue-50/30 transition-colors ${isSelected ? 'bg-blue-50/50' : isSub ? 'bg-slate-50/30' : 'bg-white'}`}>
                    <td className="py-4 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                        checked={isSelected}
                        onChange={() => toggleSelect(c.id)}
                      />
                    </td>
                    <td className="py-4 px-4 text-sm font-bold text-gray-400">{idx + 1}</td>
                    <td className="py-4 px-4">
                      {c.homeIconUrl ? (
                        <img src={toAssetUrl(c.homeIconUrl)} className="h-10 w-10 object-contain rounded bg-white shadow-sm border p-1" />
                      ) : <div className="h-10 w-10 bg-gray-100 rounded border border-dashed" />}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col">
                        <span className={`text-sm font-black tracking-tight ${isSub ? 'text-blue-600' : 'text-gray-900'}`}>
                          {isSub && <span className="text-gray-300 mr-1">↳</span>}
                          {c.title}
                        </span>
                        <span className="text-[10px] text-gray-400 font-bold uppercase">{c.slug}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1.5">
                        {c.sectionType ? (
                          <span className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded text-xs font-bold border border-purple-200 inline-block w-fit">
                            {c.sectionType}
                          </span>
                        ) : parents.length > 0 ? (
                          <>
                            <div className="flex flex-wrap gap-1">
                              {parents.map(parent => (
                                <span key={parent.id} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-black border border-blue-200">
                                  {parent.title}
                                </span>
                              ))}
                            </div>
                            <span className="text-[10px] text-slate-500 font-bold">
                              {parents.map(parent => parent.title).filter(Boolean).join(", ")}
                            </span>
                          </>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-bold uppercase italic">No Parent</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-block whitespace-nowrap px-2 py-1 bg-amber-50 text-amber-700 rounded text-xs font-black border border-amber-200">
                        ₹{c.hourlyPrice || 0}/hr
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1.5">
                        {isSub ? (
                          <>
                            <span className="px-2 py-0.5 bg-sky-100 text-sky-700 rounded text-[10px] font-black border border-sky-200 inline-block w-fit">SUB CATEGORY</span>
                            {c.isAlwaysMain && <span className="text-[9px] text-cyan-600 font-black uppercase italic">★ Featured in Main</span>}
                          </>
                        ) : (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-black border border-green-200 inline-block w-fit">MAIN CATEGORY</span>
                        )}
                        {children.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1 items-center">
                            <span className="text-[9px] text-gray-400 font-bold uppercase italic mr-1">Sub Categories:</span>
                            {children.map(child => (
                              <span key={child.id} className="text-[9px] text-gray-500 bg-gray-100 px-1 rounded font-bold uppercase">{child.title}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => { setEditingId(c.id); setIsModalOpen(true); }} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"><FiEdit2 /></button>
                        <button onClick={() => remove(c.id)} className="p-1.5 bg-rose-50 text-rose-600 rounded hover:bg-rose-100"><FiTrash2 /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {categoriesFiltered.length === 0 && (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-sm font-bold text-gray-400">
                    No categories found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardShell>

      <Modal isOpen={isModalOpen} onClose={reset} title={editing ? "Edit Category" : "Add Category"} size="md">
        <div className="space-y-4">
          {/* Home Page Tab Section (First) */}
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-1">
              Home Page Tab Section <span className="text-red-500">*</span>
            </label>
            <select
              value={form.sectionType}
              onChange={e => setForm({ ...form, sectionType: e.target.value })}
              className="w-full px-3.5 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-semibold text-gray-800 text-sm bg-white"
            >
              <option value="" disabled>Select a category</option>
              {premiumOfferings.filter(o => o.actionPayload || o.title).map(o => {
                const sectionName = o.actionPayload || o.title;
                return <option key={o._id || o.id} value={sectionName}>{o.title}</option>
              })}
            </select>
          </div>

          {/* Title (Under Home Page Tab Section) */}
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              className="w-full px-3.5 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium text-sm"
              placeholder="e.g. Tractor, Rotavator"
            />
          </div>

          {/* Home Icon */}
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-1">
              Home Icon <span className="text-red-500">*</span>
            </label>
            <div className={`border border-dashed rounded-xl p-3 bg-gray-50/50 ${form.homeIconUrl ? 'border-emerald-300 bg-emerald-50/20' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={async e => {
                    const f = e.target.files[0];
                    if (!f) return;
                    setUploadingIcon(true);
                    const res = await serviceService.uploadImage(f, 'categories');
                    if (res.success) setForm({ ...form, homeIconUrl: res.imageUrl });
                    setUploadingIcon(false);
                  }}
                  className="w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 cursor-pointer"
                />
                {uploadingIcon && <p className="text-xs text-primary-600 font-bold animate-pulse whitespace-nowrap">Uploading...</p>}
                {form.homeIconUrl && (
                  <div className="relative group shrink-0">
                    <img src={toAssetUrl(form.homeIconUrl)} className="h-10 w-10 object-contain bg-white rounded-lg shadow-sm border border-gray-200 p-1" />
                    <button onClick={() => setForm({ ...form, homeIconUrl: "" })} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white p-0.5 rounded-full shadow hover:bg-red-600 transition-colors"><FiX className="w-3 h-3" /></button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Hourly Price (1 Hour Rate) */}
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-1">
              1 Hour Price (₹) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">₹</span>
              <input
                type="number"
                min="1"
                value={form.hourlyPrice}
                onChange={e => setForm({ ...form, hourlyPrice: e.target.value === '' ? '' : Number(e.target.value) })}
                className="w-full pl-8 pr-3.5 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-bold text-gray-800 text-sm"
                placeholder="Enter 1 hour rate (e.g. 500)"
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">Kitna charge legi yeh category 1 hour ka (Hourly rate)</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={upsert}
              disabled={loading}
              className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl font-bold uppercase text-xs shadow-md shadow-primary-200 hover:bg-primary-700 active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
              ) : <FiSave className="w-4 h-4" />}
              {loading ? "SAVING..." : (editing ? "Update Category" : "Add Category")}
            </button>
            <button onClick={reset} className="px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default CategoriesPage;

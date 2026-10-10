import React, { useEffect, useMemo, useState } from "react";
import { FiGrid, FiPlus, FiEdit2, FiTrash2, FiSave, FiChevronUp, FiChevronDown, FiMove, FiX, FiSearch } from "react-icons/fi";
import { toast } from "react-hot-toast";
import CardShell from "../components/CardShell";
import Modal from "../components/Modal";
import { saveCatalog, slugify, toAssetUrl } from "../utils";

import { categoryService, serviceService, homeContentService } from "../../../../../services/catalogService";
import { z } from "zod";

const categorySchema = z.object({
  title: z.string().min(2, "Category title must be at least 2 characters"),
  slug: z.string().optional(),
  homeIconUrl: z.string().optional(),
  homeBadge: z.string().optional(),
  hasSaleBadge: z.boolean(),
  showOnHome: z.boolean(),
  parentCategory: z.string().nullable().optional(),
  parentCategories: z.array(z.string()).optional(),
  isAlwaysMain: z.boolean().default(false),
  requiresDriver: z.boolean().default(false),
  sectionType: z.string().default('General'),
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
    sectionType: "General",
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
          sectionType: cat.sectionType || 'General',
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
      sectionType: editing.sectionType || "General",
    });
  }, [editingId, editing]);

  const reset = () => {
    setEditingId(null);
    setForm({
      title: "", slug: "", homeIconUrl: "", homeBadge: "",
      hasSaleBadge: false, showOnHome: true, parentCategory: "",
      parentCategories: [], isAlwaysMain: false,
      trackingType: "none", requiresDriver: false,
      sectionType: "General",
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
    sectionType: cat.sectionType || 'General',
  });

  const upsert = async () => {
    const val = categorySchema.safeParse({
      ...form,
      title: form.title.trim(),
      slug: slugify(form.title.trim()),
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
        fetchCategories();
      }
    } catch (error) {
      toast.error("Delete failed");
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
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-600 font-bold uppercase tracking-tight">{categoriesFiltered.length} Items</div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text" placeholder="Search..." value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              />
            </div>
            <button onClick={() => setShowReorderModal(true)} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold flex items-center gap-2">
              <FiMove /> Reorder
            </button>
            <button
              onClick={() => { reset(); setIsModalOpen(true); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold flex items-center gap-2"
            >
              <FiPlus /> Add Category
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200 bg-gray-50/50">
                <th className="text-left py-3 px-4 text-xs font-black text-gray-400 uppercase tracking-widest w-12">#</th>
                <th className="text-left py-3 px-4 text-xs font-black text-gray-400 uppercase tracking-widest w-20">Icon</th>
                <th className="text-left py-3 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">Category Name</th>
                <th className="text-left py-3 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">Parent Categories</th>
                <th className="text-left py-3 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">Section Tab</th>
                <th className="text-left py-3 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">Hierarchy</th>
                <th className="text-left py-3 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">Tracking</th>
                <th className="text-center py-3 px-4 text-xs font-black text-gray-400 uppercase tracking-widest w-20">Sort</th>
                <th className="text-center py-3 px-4 text-xs font-black text-gray-400 uppercase tracking-widest w-30">Status</th>
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
                return (
                  <tr key={c.id} className={`hover:bg-blue-50/30 transition-colors ${isSub ? 'bg-slate-50/30' : 'bg-white'}`}>
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
                        {parents.length > 0 ? (
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
                      <span className="inline-block whitespace-nowrap px-2 py-1 bg-purple-50 text-purple-700 rounded text-[10px] font-black border border-purple-200">
                        {c.sectionType || 'General'}
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
                      <div className="flex flex-col gap-1">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded w-fit ${c.trackingType === 'timestamp' ? 'bg-indigo-100 text-indigo-700' : c.trackingType === 'odometer' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                          {c.trackingType?.toUpperCase() || 'NONE'}
                        </span>
                        {c.requiresDriver && <span className="text-[9px] text-rose-600 font-black uppercase">● Driver Required</span>}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => moveOrder(c.id, idx - 1)} disabled={idx === 0} className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-20"><FiChevronUp /></button>
                        <button onClick={() => moveOrder(c.id, idx + 1)} disabled={idx === categoriesFiltered.length - 1} className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-20"><FiChevronDown /></button>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`px-2 py-1 text-[10px] font-black rounded uppercase ${c.showOnHome ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                        {c.showOnHome ? 'Visible' : 'Hidden'}
                      </span>
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
            </tbody>
          </table>
        </div>
      </CardShell>

      <Modal isOpen={isModalOpen} onClose={reset} title={editing ? "Edit Category" : "Add Category"} size="lg">
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-base font-bold text-gray-900 mb-2">Title</label>
              <input
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="e.g. Tractor, Rotavator"
              />
            </div>
            <div>
              <label className="block text-base font-bold text-gray-900 mb-2">Parent Categories (Select multiple)</label>
              <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-xl p-3 bg-white space-y-2">
                {categoriesBase.filter(c => c.id !== editingId).map(c => (
                  <label key={c.id} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      checked={form.parentCategories.includes(c.id)}
                      onChange={e => {
                        const checked = e.target.checked;
                        setForm(p => ({
                          ...p,
                          parentCategories: checked ? [...p.parentCategories, c.id] : p.parentCategories.filter(id => id !== c.id)
                        }));
                      }}
                    />
                    <span className="text-sm font-semibold text-gray-700 group-hover:text-primary-600">{c.title}</span>
                  </label>
                ))}
                {categoriesBase.filter(c => c.id !== editingId).length === 0 && (
                  <p className="text-xs text-gray-400 italic">No main categories available</p>
                )}
              </div>
              <p className="text-[10px] text-gray-500 mt-1">If none selected, this will be a Main Category.</p>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="alwaysMain"
                checked={form.isAlwaysMain}
                onChange={e => setForm({ ...form, isAlwaysMain: e.target.checked })}
                className="h-4 w-4 accent-primary-600"
              />
              <label htmlFor="alwaysMain" className="text-base font-bold text-gray-900">Always show in Main List</label>
            </div>
            <p className="text-[11px] text-gray-400 leading-tight pl-7">Useful for tools like "Rotavator" that should be visible even when they are sub-categories.</p>
          </div>

          <div>
            <label className="block text-base font-bold text-gray-900 mb-2">Home Page Tab Section</label>
            <select
              value={form.sectionType}
              onChange={e => setForm({ ...form, sectionType: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 font-semibold"
            >
              <option value="General">General (Default scrolling list)</option>
              {premiumOfferings.filter(o => o.actionPayload || o.title).map(o => {
                const sectionName = o.actionPayload || o.title;
                return <option key={o._id || o.id} value={sectionName}>{o.title} - ({sectionName})</option>
              })}
            </select>
          </div>

          <div>
            <label className="block text-base font-bold text-gray-900 mb-2">Home Icon</label>
            <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 bg-gray-50/30">
              <div className="flex flex-col items-center gap-3">
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
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 cursor-pointer"
                />
                {uploadingIcon && <p className="text-xs text-primary-600 font-bold animate-pulse">Uploading...</p>}
                {form.homeIconUrl && (
                  <div className="relative group mt-2">
                    <img src={toAssetUrl(form.homeIconUrl)} className="h-20 w-20 object-contain bg-white rounded-xl shadow-sm border border-gray-200 p-2" />
                    <button onClick={() => setForm({ ...form, homeIconUrl: "" })} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"><FiX /></button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-orange-50/50 p-5 rounded-2xl border border-orange-100 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-orange-700 uppercase tracking-wider">⚙ Machinery Classification</span>
            </div>
            <p className="text-xs text-orange-600 font-medium">Only set this for Equipment Catalog categories. Leave as "None" for Soil Testing or E-commerce.</p>
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-orange-700 mb-1 uppercase tracking-tighter">Tracking Type</label>
                <select
                  value={form.trackingType}
                  onChange={e => setForm({ ...form, trackingType: e.target.value })}
                  className="w-full text-sm font-bold p-3 rounded-xl border border-orange-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
                >
                  <option value="none">None (Default - Not a Machine)</option>
                  <option value="odometer">Odometer (Moving Machine - Tractor/Harvester)</option>
                  <option value="timestamp">Timestamp (Static Tool - Pump/Sprayer)</option>
                </select>
              </div>
              <div className="flex items-center gap-3 pt-5">
                <input
                  id="reqDriver"
                  type="checkbox"
                  checked={form.requiresDriver}
                  onChange={e => setForm({ ...form, requiresDriver: e.target.checked })}
                  className="h-5 w-5 accent-orange-500"
                />
                <label htmlFor="reqDriver" className="text-sm font-bold text-orange-800 uppercase cursor-pointer">Requires registered Driver/Operator</label>
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              onClick={upsert}
              disabled={loading}
              className="flex-1 py-4 bg-primary-600 text-white rounded-2xl font-black uppercase text-sm shadow-xl shadow-primary-200 hover:bg-primary-700 hover:shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : <FiSave className="w-5 h-5" />}
              {loading ? "SAVING..." : (editing ? "Update Category" : "Add Category")}
            </button>
            <button onClick={reset} className="px-8 py-4 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showReorderModal} onClose={() => setShowReorderModal(false)} title="Reorder Categories">
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {categoriesFiltered.map((c, i) => (
            <div key={c.id} draggable onDragStart={e => handleDragStart(e, i)} onDragOver={handleDragOver} onDrop={e => handleDrop(e, i)} className={`p-3 border rounded-lg bg-white flex items-center justify-between cursor-move hover:border-blue-300 ${draggedItem === i ? 'opacity-40' : ''}`}>
              <div className="flex items-center gap-3">
                <span className="text-xs font-black text-gray-300">#{i + 1}</span>
                <span className="text-sm font-black uppercase">{c.title}</span>
              </div>
              <FiMove className="text-gray-400" />
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default CategoriesPage;

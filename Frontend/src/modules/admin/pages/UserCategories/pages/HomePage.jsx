import React, { useMemo, useState, useEffect } from "react";
import { FiGrid, FiPlus, FiTrash2, FiSave, FiEdit2, FiX, FiArrowUp, FiArrowDown } from "react-icons/fi";
import { toast } from "react-hot-toast";
import CardShell from "../components/CardShell";
import Modal from "../components/Modal";
import ToggleSwitch from "../components/ToggleSwitch";
import { ensureIds, saveCatalog, slugify, toAssetUrl } from "../utils";

import { homeContentService, serviceService } from "../../../../../services/catalogService";

const RedirectionSelector = ({
  targetCategoryId,
  slug,
  onChange,
  label = "Redirection Target",
  categories = [],
  allServices = []
}) => {
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSlug, setSelectedSlug] = useState("");

  useEffect(() => {
    setSelectedSlug(slug || "");

    const serviceFromSlug = (slug && allServices?.length)
      ? allServices.find(s => s.slug === slug)
      : null;

    if (serviceFromSlug?.categoryId) {
      const catId = serviceFromSlug.categoryId?._id || serviceFromSlug.categoryId;
      setSelectedCategory(typeof catId === 'object' ? String(catId) : catId);
    } else if (targetCategoryId) {
      const catId = targetCategoryId?._id || targetCategoryId;
      setSelectedCategory(typeof catId === 'object' ? String(catId || "") : (catId || ""));
    } else if (!slug) {
      setSelectedCategory("");
    }
  }, [slug, targetCategoryId, allServices]);

  const handleCategoryChange = (e) => {
    const catId = e.target.value;
    setSelectedCategory(catId);
    setSelectedSlug("");
    onChange({ targetCategoryId: catId, slug: null, targetServiceId: null });
  };

  const handleServiceChange = (e) => {
    const svcSlug = e.target.value;
    setSelectedSlug(svcSlug);
    const svc = allServices.find(s => s.slug === svcSlug);
    onChange({
      targetCategoryId: selectedCategory,
      slug: svcSlug || null,
      targetServiceId: svc ? (svc.id || svc._id) : null
    });
  };

  const filteredServices = selectedCategory
    ? allServices.filter(s => {
      const sCatId = s.categoryId?._id || s.categoryId;
      return String(sCatId) === String(selectedCategory);
    })
    : [];

  return (
    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
      <label className="block text-sm font-bold text-gray-700 mb-3">{label}</label>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
            1. Select Category
          </label>
          <select
            value={selectedCategory}
            onChange={handleCategoryChange}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
          >
            <option value="">-- Choose Category --</option>
            {(categories || []).map((c) => (
              <option key={c.id || c._id} value={c.id || c._id}>
                {c.title || "Untitled Category"}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
            2. Select Equipment
          </label>
          <select
            value={selectedSlug}
            onChange={handleServiceChange}
            disabled={!selectedCategory}
            className={`w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white transition-all text-sm ${!selectedCategory ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              }`}
          >
            <option value="" disabled>-- Select Equipment --</option>
            {filteredServices.map((s) => (
              <option key={s.id || s._id} value={s.slug || ""}>
                {s.title || "Untitled Equipment"}
              </option>
            ))}
            {selectedCategory && filteredServices.length === 0 && (
              <option disabled>No services found in this category</option>
            )}
          </select>
          {selectedSlug && (
            <p className="text-xs text-blue-600 mt-1 font-medium">
              * Will redirect to Equipment Details page
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const HomePage = ({ catalog, setCatalog, selectedCity }) => {
  // Promo Carousel state
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [promoForm, setPromoForm] = useState({
    title: "",
    subtitle: "",
    buttonText: "Explore",
    gradientClass: "from-blue-600 to-blue-800",
    imageUrl: "",
    targetCategoryId: "",
    slug: "",
    targetServiceId: "",
    scrollToSection: ""
  });
  const [editingPromoId, setEditingPromoId] = useState(null);

  // Explore Services (Quick Actions Grid) state
  const [isPremiumOfferingsModalOpen, setIsPremiumOfferingsModalOpen] = useState(false);
  const [premiumOfferingsForm, setPremiumOfferingsForm] = useState({
    title: "",
    subtitle: "",
    imageUrl: "",
    colorCode: "#3b82f6",
    route: "",
    actionType: "navigate",
    actionPayload: ""
  });
  const [editingPremiumOfferingsId, setEditingPremiumOfferingsId] = useState(null);

  // Equipment Curations state
  const [isCuratedModalOpen, setIsCuratedModalOpen] = useState(false);
  const [curatedForm, setCuratedForm] = useState({ title: "", gifUrl: "", youtubeUrl: "" });
  const [editingCuratedId, setEditingCuratedId] = useState(null);

  // New & Noteworthy state
  const [isNoteworthyModalOpen, setIsNoteworthyModalOpen] = useState(false);
  const [noteworthyForm, setNoteworthyForm] = useState({
    title: "",
    imageUrl: "",
    targetCategoryId: "",
    slug: "",
    targetServiceId: ""
  });
  const [editingNoteworthyId, setEditingNoteworthyId] = useState(null);

  // General states
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFetchingCityData, setIsFetchingCityData] = useState(false);
  const [allServices, setAllServices] = useState([]);

  const categories = useMemo(() => {
    const list = ensureIds(catalog).categories || [];
    return [...list].sort((a, b) => {
      const ao = Number.isFinite(a.homeOrder) ? a.homeOrder : 0;
      const bo = Number.isFinite(b.homeOrder) ? b.homeOrder : 0;
      if (ao !== bo) return ao - bo;
      return (a.title || "").localeCompare(b.title || "");
    });
  }, [catalog]);

  const home = ensureIds(catalog).home;

  const getCategoryTitle = (id) => {
    const c = categories.find((x) => x.id === id || x._id === id);
    return c ? c.title : "—";
  };

  // Fetch all services for redirection selection
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const response = await serviceService.getAll({ limit: 1000 });
        if (response.success) {
          setAllServices(response.services || []);
        }
      } catch (error) {
        console.error("Failed to fetch services for redirection:", error);
      }
    };
    fetchServices();
  }, []);

  // Fetch home content from API on mount or city change
  useEffect(() => {
    const fetchHomeContent = async () => {
      setIsFetchingCityData(true);
      try {
        const params = {};
        if (selectedCity) params.cityId = selectedCity;

        const response = await homeContentService.get(params);
        if (response.success && response.homeContent) {
          const hc = response.homeContent;

          const addIds = (items) => {
            return (items || []).map((item, idx) => ({
              ...item,
              id: item.id || (item._id ? item._id.toString() : `item-${Date.now()}-${idx}`),
              targetCategoryId: item.targetCategoryId
                ? (typeof item.targetCategoryId === 'object' ? item.targetCategoryId.toString() : item.targetCategoryId)
                : item.targetCategoryId,
              targetServiceId: item.targetServiceId
                ? (typeof item.targetServiceId === 'object' ? item.targetServiceId.toString() : item.targetServiceId)
                : item.targetServiceId
            }));
          };

          const next = ensureIds(catalog);
          next.home = {
            banners: [],
            promoCarousel: addIds(hc.promos || []),
            curatedServices: addIds(hc.curated || []),
            newAndNoteworthy: addIds(hc.noteworthy || []),
            mostBooked: [],
            premiumOfferings: addIds(hc.premiumOfferings || []),
            categorySections: [],
            isBannersVisible: false,
            isPromosVisible: hc.isPromosVisible ?? true,
            isCuratedVisible: hc.isCuratedVisible ?? true,
            isNoteworthyVisible: hc.isNoteworthyVisible ?? true,
            isBookedVisible: false,
            isCategorySectionsVisible: false,
            isCategoriesVisible: hc.isCategoriesVisible ?? true,
            isPremiumOfferingsVisible: hc.isPremiumOfferingsVisible ?? true,
            exploreServicesTitle: hc.exploreServicesTitle || '',
            exploreServicesSubtitle: hc.exploreServicesSubtitle || '',
            showWeatherTile: hc.showWeatherTile ?? true
          };
          setCatalog(next);
        }
      } catch (error) {
        console.error('Failed to fetch home content:', error);
      } finally {
        setIsFetchingCityData(false);
      }
    };

    fetchHomeContent();
  }, [selectedCity]);

  const syncHomeToBackend = async (homeData) => {
    setIsSyncing(true);
    try {
      const payload = {
        promos: homeData.promoCarousel || [],
        curated: homeData.curatedServices || [],
        noteworthy: homeData.newAndNoteworthy || [],
        premiumOfferings: homeData.premiumOfferings || [],
        isBannersVisible: false,
        isPromosVisible: homeData.isPromosVisible ?? true,
        isCuratedVisible: homeData.isCuratedVisible ?? true,
        isNoteworthyVisible: homeData.isNoteworthyVisible ?? true,
        isBookedVisible: false,
        isCategorySectionsVisible: false,
        isCategoriesVisible: homeData.isCategoriesVisible ?? true,
        isPremiumOfferingsVisible: homeData.isPremiumOfferingsVisible ?? true,
        exploreServicesTitle: homeData.exploreServicesTitle ?? '',
        exploreServicesSubtitle: homeData.exploreServicesSubtitle ?? '',
        showWeatherTile: homeData.showWeatherTile ?? true
      };
      await homeContentService.update(payload, { cityId: selectedCity });
      toast.success('Home page updated successfully!');
    } catch (error) {
      console.error('Failed to sync home content:', error);
      const msg = error.response?.data?.message || error.message || 'Failed to save changes to server';
      toast.error(msg);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  const patchHome = async (patch) => {
    const next = ensureIds(catalog);
    next.home = { ...(next.home || {}), ...patch };
    setCatalog(next);
    saveCatalog(next);
    return await syncHomeToBackend(next.home);
  };

  // Promo Carousel Handlers
  const resetPromoForm = () => {
    setEditingPromoId(null);
    setPromoForm({
      title: "",
      subtitle: "",
      buttonText: "Explore",
      gradientClass: "from-blue-600 to-blue-800",
      imageUrl: "",
      targetCategoryId: "",
      slug: "",
      targetServiceId: "",
      scrollToSection: ""
    });
    setIsPromoModalOpen(false);
  };

  const savePromo = async () => {
    try {
      const promos = home?.promoCarousel || [];
      if (editingPromoId) {
        await patchHome({ promoCarousel: promos.map((p) => (p.id === editingPromoId ? { ...p, ...promoForm } : p)) });
      } else {
        await patchHome({ promoCarousel: [...promos, { id: `hprm-${Date.now()}`, ...promoForm }] });
      }
      resetPromoForm();
    } catch (error) {}
  };

  // Explore Services (Quick Actions Grid) Handlers
  const resetPremiumOfferingsForm = () => {
    setEditingPremiumOfferingsId(null);
    setPremiumOfferingsForm({
      title: "",
      subtitle: "",
      imageUrl: "",
      colorCode: "#3b82f6",
      route: "",
      actionType: "navigate",
      actionPayload: ""
    });
    setIsPremiumOfferingsModalOpen(false);
  };

  const savePremiumOfferings = async () => {
    try {
      const title = premiumOfferingsForm.title?.trim();
      if (!title) {
        toast.error("Title is required");
        return;
      }
      const offerings = home?.premiumOfferings || [];
      const itemData = {
        ...premiumOfferingsForm,
        actionPayload: premiumOfferingsForm.actionType === 'navigate'
          ? (premiumOfferingsForm.route || '')
          : title
      };

      if (editingPremiumOfferingsId) {
        await patchHome({
          premiumOfferings: offerings.map((o) =>
            o.id === editingPremiumOfferingsId ? { ...o, ...itemData } : o
          ),
        });
      } else {
        await patchHome({
          premiumOfferings: [
            ...offerings,
            { id: `hpre-${Date.now()}`, ...itemData, order: offerings.length }
          ],
        });
      }
      resetPremiumOfferingsForm();
    } catch (error) {}
  };

  const movePremiumOffering = async (id, dir) => {
    const list = [...(home.premiumOfferings || [])];
    const idx = list.findIndex(item => item.id === id);
    if (idx === -1) return;
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const [item] = list.splice(idx, 1);
    list.splice(targetIdx, 0, item);
    const updated = list.map((it, i) => ({ ...it, order: i }));
    await patchHome({ premiumOfferings: updated });
  };

  // Curated Services Handlers
  const resetCuratedForm = () => {
    setEditingCuratedId(null);
    setCuratedForm({ title: "", gifUrl: "", youtubeUrl: "" });
    setIsCuratedModalOpen(false);
  };

  const saveCurated = async () => {
    try {
      const curated = home?.curatedServices || [];
      if (editingCuratedId) {
        await patchHome({ curatedServices: curated.map((s) => (s.id === editingCuratedId ? { ...s, ...curatedForm } : s)) });
      } else {
        await patchHome({ curatedServices: [...curated, { id: `hcur-${Date.now()}`, ...curatedForm }] });
      }
      resetCuratedForm();
    } catch (error) {}
  };

  // New & Noteworthy Handlers
  const resetNoteworthyForm = () => {
    setEditingNoteworthyId(null);
    setNoteworthyForm({ title: "", imageUrl: "", targetCategoryId: "", slug: "", targetServiceId: "" });
    setIsNoteworthyModalOpen(false);
  };

  const saveNoteworthy = async () => {
    try {
      const noteworthy = home?.newAndNoteworthy || [];
      if (editingNoteworthyId) {
        await patchHome({ newAndNoteworthy: noteworthy.map((s) => (s.id === editingNoteworthyId ? { ...s, ...noteworthyForm } : s)) });
      } else {
        await patchHome({ newAndNoteworthy: [...noteworthy, { id: `hnot-${Date.now()}`, ...noteworthyForm }] });
      }
      resetNoteworthyForm();
    } catch (error) {}
  };

  if (isFetchingCityData) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-sm border border-slate-100 min-h-[400px]">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-bold text-lg animate-pulse">Loading City Data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CardShell icon={FiGrid}>
        <div className="space-y-8">
          {/* Explore Services header + weather tile */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="pb-3 border-b border-gray-200">
              <div className="text-xl font-bold text-gray-900">Explore Services Header</div>
              <div className="text-sm text-gray-500 mt-1">Title/subtitle above the service categories, and the weather tile</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                key={`title-${selectedCity}-${home?.exploreServicesTitle}`}
                defaultValue={home?.exploreServicesTitle || ''}
                onBlur={(e) => e.target.value !== (home?.exploreServicesTitle || '') && patchHome({ exploreServicesTitle: e.target.value })}
                placeholder="Title (e.g. Explore Services)"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
              />
              <input
                key={`subtitle-${selectedCity}-${home?.exploreServicesSubtitle}`}
                defaultValue={home?.exploreServicesSubtitle || ''}
                onBlur={(e) => e.target.value !== (home?.exploreServicesSubtitle || '') && patchHome({ exploreServicesSubtitle: e.target.value })}
                placeholder="Subtitle"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
              />
            </div>
            <ToggleSwitch
              label="Show Weather Tile"
              checked={home?.showWeatherTile !== false}
              onChange={() => patchHome({ showWeatherTile: home?.showWeatherTile === false })}
            />
          </div>

          {/* ======================================================== */}
          {/* SECTION 1: Home Promo Carousel */}
          {/* ======================================================== */}
          <div>
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3 pb-3 mb-4 border-b border-gray-200">
                <div>
                  <div className="text-xl font-bold text-gray-900">Home Promo Carousel</div>
                  <div className="text-sm text-gray-500 mt-1">Manage carousel banners shown at the top of the user home screen</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <ToggleSwitch
                  label="Show Promos"
                  checked={home?.isPromosVisible !== false}
                  onChange={() => patchHome({ isPromosVisible: !home?.isPromosVisible })}
                />
                <button
                  type="button"
                  onClick={() => {
                    resetPromoForm();
                    setIsPromoModalOpen(true);
                  }}
                  className="px-5 py-2.5 rounded-xl text-white transition-all flex items-center gap-2 text-sm font-semibold shadow-md hover:shadow-lg"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'linear-gradient(to right, #2874F0, #1e5fd4)',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <FiPlus className="w-4 h-4" style={{ display: 'block', color: '#ffffff' }} />
                  <span>Add Promo</span>
                </button>
              </div>
            </div>

            {(home.promoCarousel || []).length === 0 ? (
              <div className="text-base text-gray-500 py-6 text-center">No promo cards added yet</div>
            ) : (
              <div className="overflow-x-auto mt-4">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 w-12">#</th>
                      <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 w-24">Image</th>
                      <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">Title</th>
                      <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">Subtitle</th>
                      <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">Button Text</th>
                      <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">Redirect</th>
                      <th className="text-center py-3 px-4 text-sm font-bold text-gray-700 w-32">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(home.promoCarousel || []).map((p, idx) => (
                      <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-4 text-sm font-semibold text-gray-600">{idx + 1}</td>
                        <td className="py-4 px-4">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt="Promo" className="h-14 w-14 object-cover rounded-lg border border-gray-200" />
                          ) : (
                            <div className="h-14 w-14 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                              <span className="text-[10px] text-gray-400">No img</span>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-sm font-semibold text-gray-900">{p.title || "—"}</div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-sm text-gray-600">{p.subtitle || "—"}</div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-sm text-gray-600">{p.buttonText || "—"}</div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-sm text-gray-600">
                            {p.slug
                              ? `Equipment: ${allServices.find(s => s.slug === p.slug)?.title || p.slug}`
                              : (p.targetCategoryId ? getCategoryTitle(p.targetCategoryId) : "—")
                            }
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPromoId(p.id);
                                setPromoForm({ ...p });
                                setIsPromoModalOpen(true);
                              }}
                              className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                              title="Edit"
                            >
                              <FiEdit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => patchHome({ promoCarousel: (home.promoCarousel || []).filter((x) => x.id !== p.id) })}
                              className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                              title="Delete"
                            >
                              <FiTrash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* SECTION 2: Explore Services (Quick Actions Grid)         */}
          {/* Placed DIRECTLY below Home Promo Carousel                 */}
          {/* ======================================================== */}
          <div>
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3 pb-3 mb-4 border-b border-gray-200">
                <div>
                  <div className="text-xl font-bold text-gray-900">Explore Services (Quick Actions Grid)</div>
                  <div className="text-sm text-gray-500 mt-1">Manage the quick actions and services shown right under promo carousel</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <ToggleSwitch
                  label="Show Quick Actions"
                  checked={home?.isPremiumOfferingsVisible !== false}
                  onChange={() => patchHome({ isPremiumOfferingsVisible: !home?.isPremiumOfferingsVisible })}
                />
                <button
                  type="button"
                  onClick={() => {
                    resetPremiumOfferingsForm();
                    setIsPremiumOfferingsModalOpen(true);
                  }}
                  className="px-5 py-2.5 rounded-xl text-white transition-all flex items-center gap-2 text-sm font-semibold shadow-md hover:shadow-lg"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'linear-gradient(to right, #2874F0, #1e5fd4)',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <FiPlus className="w-4 h-4" style={{ display: 'block', color: '#ffffff' }} />
                  <span>Add Action</span>
                </button>
              </div>
            </div>

            {(home.premiumOfferings || []).length === 0 ? (
              <div className="text-base text-gray-500 py-6 text-center">No quick actions added yet</div>
            ) : (
              <div className="overflow-x-auto mt-4">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 w-12">#</th>
                      <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 w-24">Image</th>
                      <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">Title</th>
                      <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">Subtitle</th>
                      <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">Action Type</th>
                      <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">Target / Route</th>
                      <th className="text-center py-3 px-4 text-sm font-bold text-gray-700 w-28">Order</th>
                      <th className="text-center py-3 px-4 text-sm font-bold text-gray-700 w-28">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(home.premiumOfferings || []).map((p, idx) => (
                      <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-4 text-sm font-semibold text-gray-600">{idx + 1}</td>
                        <td className="py-4 px-4">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt="Preview" className="h-12 w-12 object-cover rounded-lg border border-gray-200" />
                          ) : (
                            <div className="h-12 w-12 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                              <span className="text-xs text-gray-400">No img</span>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-sm font-semibold text-gray-900">{p.title || "—"}</div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-sm text-gray-600">{p.subtitle || "—"}</div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="inline-block px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-50 text-blue-700">
                            {p.actionType === 'navigate' ? 'Route' : 'Section Tab'}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-sm text-gray-600 font-mono text-xs">{p.actionType === 'navigate' ? p.route : (p.actionPayload || p.title || '—')}</div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => movePremiumOffering(p.id, "up")}
                              disabled={idx === 0}
                              className="p-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Move up"
                            >
                              <FiArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => movePremiumOffering(p.id, "down")}
                              disabled={idx === (home.premiumOfferings || []).length - 1}
                              className="p-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Move down"
                            >
                              <FiArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPremiumOfferingsId(p.id);
                                setPremiumOfferingsForm({ ...p });
                                setIsPremiumOfferingsModalOpen(true);
                              }}
                              className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                              title="Edit"
                            >
                              <FiEdit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => patchHome({ premiumOfferings: (home.premiumOfferings || []).filter((x) => x.id !== p.id) })}
                              className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                              title="Delete"
                            >
                              <FiTrash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* SECTION 3: Equipment Curations                           */}
          {/* ======================================================== */}
          <div>
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3 pb-3 mb-4 border-b border-gray-200">
                <div>
                  <div className="text-xl font-bold text-gray-900">Equipment Curations</div>
                  <div className="text-sm text-gray-500 mt-1">Curated video/GIF showcase equipment cards</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <ToggleSwitch
                  label="Show Curated"
                  checked={home?.isCuratedVisible !== false}
                  onChange={() => patchHome({ isCuratedVisible: !home?.isCuratedVisible })}
                />
                <button
                  type="button"
                  onClick={() => {
                    resetCuratedForm();
                    setIsCuratedModalOpen(true);
                  }}
                  className="px-5 py-2.5 rounded-xl text-white transition-all flex items-center gap-2 text-sm font-semibold shadow-md hover:shadow-lg"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'linear-gradient(to right, #2874F0, #1e5fd4)',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <FiPlus className="w-4 h-4" style={{ display: 'block', color: '#ffffff' }} />
                  <span>Add Curated</span>
                </button>
              </div>
            </div>

            {(home.curatedServices || []).length === 0 ? (
              <div className="text-base text-gray-500 py-6 text-center">No curated items added yet</div>
            ) : (
              <div className="overflow-x-auto mt-4">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 w-12">#</th>
                      <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 w-24">Media</th>
                      <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">Title</th>
                      <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">YouTube URL</th>
                      <th className="text-center py-3 px-4 text-sm font-bold text-gray-700 w-32">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(home.curatedServices || []).map((s, idx) => (
                      <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-4 text-sm font-semibold text-gray-600">{idx + 1}</td>
                        <td className="py-4 px-4">
                          {s.gifUrl ? (
                            s.gifUrl.match(/\.(gif|webp)$/i) ? (
                              <img src={s.gifUrl} alt="Preview" className="h-14 w-14 object-cover rounded-lg border border-gray-200" />
                            ) : (
                              <video src={s.gifUrl} className="h-14 w-14 object-cover rounded-lg border border-gray-200" controls />
                            )
                          ) : (
                            <div className="h-14 w-14 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                              <span className="text-[10px] text-gray-400">No media</span>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-sm font-semibold text-gray-900">{s.title || "—"}</div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-sm text-gray-600">{s.youtubeUrl || "—"}</div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCuratedId(s.id);
                                setCuratedForm({ ...s });
                                setIsCuratedModalOpen(true);
                              }}
                              className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                              title="Edit"
                            >
                              <FiEdit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => patchHome({ curatedServices: (home.curatedServices || []).filter((x) => x.id !== s.id) })}
                              className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                              title="Delete"
                            >
                              <FiTrash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* SECTION 4: New & Noteworthy                              */}
          {/* ======================================================== */}
          <div>
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3 pb-3 mb-4 border-b border-gray-200">
                <div>
                  <div className="text-xl font-bold text-gray-900">New & Noteworthy</div>
                  <div className="text-sm text-gray-500 mt-1">Highlighted services and seasonal features</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <ToggleSwitch
                  label="Show Noteworthy"
                  checked={home?.isNoteworthyVisible !== false}
                  onChange={() => patchHome({ isNoteworthyVisible: !home?.isNoteworthyVisible })}
                />
                <button
                  type="button"
                  onClick={() => {
                    resetNoteworthyForm();
                    setIsNoteworthyModalOpen(true);
                  }}
                  className="px-5 py-2.5 rounded-xl text-white transition-all flex items-center gap-2 text-sm font-semibold shadow-md hover:shadow-lg"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'linear-gradient(to right, #2874F0, #1e5fd4)',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <FiPlus className="w-4 h-4" style={{ display: 'block', color: '#ffffff' }} />
                  <span>Add Noteworthy</span>
                </button>
              </div>
            </div>

            {(home.newAndNoteworthy || []).length === 0 ? (
              <div className="text-base text-gray-500 py-6 text-center">No noteworthy items added yet</div>
            ) : (
              <div className="overflow-x-auto mt-4">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 w-12">#</th>
                      <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 w-24">Image</th>
                      <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">Title</th>
                      <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">Redirect</th>
                      <th className="text-center py-3 px-4 text-sm font-bold text-gray-700 w-32">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(home.newAndNoteworthy || []).map((s, idx) => (
                      <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-4 text-sm font-semibold text-gray-600">{idx + 1}</td>
                        <td className="py-4 px-4">
                          {s.imageUrl ? (
                            <img src={s.imageUrl} alt="Preview" className="h-16 w-16 object-cover rounded-lg border border-gray-200" />
                          ) : (
                            <div className="h-16 w-16 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                              <span className="text-xs text-gray-400">No img</span>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-sm font-semibold text-gray-900">{s.title || "—"}</div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-sm text-gray-600">
                            {s.slug
                              ? `Service: ${allServices.find(svc => svc.slug === s.slug)?.title || s.slug}`
                              : (s.targetCategoryId ? getCategoryTitle(s.targetCategoryId) : "—")
                            }
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNoteworthyId(s.id);
                                setNoteworthyForm({ ...s });
                                setIsNoteworthyModalOpen(true);
                              }}
                              className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                              title="Edit"
                            >
                              <FiEdit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => patchHome({ newAndNoteworthy: (home.newAndNoteworthy || []).filter((x) => x.id !== s.id) })}
                              className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                              title="Delete"
                            >
                              <FiTrash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </CardShell>

      {/* ======================================================== */}
      {/* MODAL 1: Home Promo Carousel Modal                       */}
      {/* ======================================================== */}
      <Modal
        isOpen={isPromoModalOpen}
        onClose={resetPromoForm}
        title={editingPromoId ? "Edit Promo" : "Add Promo"}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-base font-bold text-gray-900 mb-2">Image</label>
            <div className="space-y-3">
              <input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setUploading(true);
                    setUploadProgress(0);
                    try {
                      const response = await serviceService.uploadImage(file, 'promos', (progress) => {
                        setUploadProgress(progress);
                      });
                      if (response.success) {
                        setPromoForm((p) => ({ ...p, imageUrl: response.imageUrl }));
                        toast.success("Image uploaded!");
                      }
                    } catch (error) {
                      console.error('Promo upload error:', error);
                      const msg = error.response?.data?.message || error.message || "Failed to upload image";
                      toast.error(msg);
                    } finally {
                      setUploading(false);
                      setUploadProgress(0);
                    }
                  }
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {uploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-blue-600 text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      Uploading...
                    </div>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-blue-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
              {promoForm.imageUrl && !uploading && (
                <div className="relative inline-block group">
                  <img src={promoForm.imageUrl} alt="Preview" className="h-24 w-auto object-cover rounded-lg border border-gray-200 shadow-sm" />
                  <button
                    onClick={() => setPromoForm(p => ({ ...p, imageUrl: "" }))}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove image"
                  >
                    <FiTrash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-base font-bold text-gray-900 mb-2">Title</label>
              <input
                value={promoForm.title}
                onChange={(e) => setPromoForm((p) => ({ ...p, title: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-white"
                placeholder="Title"
              />
            </div>
            <div>
              <label className="block text-base font-bold text-gray-900 mb-2">Subtitle</label>
              <input
                value={promoForm.subtitle}
                onChange={(e) => setPromoForm((p) => ({ ...p, subtitle: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-white"
                placeholder="Subtitle"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-base font-bold text-gray-900 mb-2">Button Text</label>
              <input
                value={promoForm.buttonText}
                onChange={(e) => setPromoForm((p) => ({ ...p, buttonText: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-white"
                placeholder="Explore"
              />
            </div>
            <div>
              <label className="block text-base font-bold text-gray-900 mb-2">Gradient Class</label>
              <input
                value={promoForm.gradientClass}
                onChange={(e) => setPromoForm((p) => ({ ...p, gradientClass: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-white"
                placeholder="from-blue-600 to-blue-800"
              />
            </div>
          </div>
          <RedirectionSelector
            categories={categories}
            allServices={allServices}
            targetCategoryId={promoForm.targetCategoryId}
            slug={promoForm.slug}
            onChange={(patch) => setPromoForm((p) => ({ ...p, ...patch }))}
            label="Redirect to..."
          />
          <div>
            <label className="block text-base font-bold text-gray-900 mb-2">Scroll To Section (optional)</label>
            <input
              value={promoForm.scrollToSection}
              onChange={(e) => setPromoForm((p) => ({ ...p, scrollToSection: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-white"
              placeholder="Soil Testing"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              onClick={savePromo}
              disabled={uploading || isSyncing}
              className={`flex-1 py-3.5 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg ${(uploading || isSyncing) ? 'opacity-50 cursor-not-allowed bg-gray-400' : ''}`}
              style={{ backgroundColor: (uploading || isSyncing) ? '#cbd5e1' : '#2874F0' }}
            >
              {(uploading || isSyncing) ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : <FiSave className="w-5 h-5" />}
              {uploading ? "Uploading..." : isSyncing ? "Saving..." : (editingPromoId ? "Update Promo" : "Add Promo")}
            </button>
            <button
              onClick={resetPromoForm}
              disabled={isSyncing}
              className="px-6 py-3.5 text-gray-700 rounded-xl font-medium hover:bg-gray-100 transition-all border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 2: Explore Services (Quick Actions Grid) Modal     */}
      {/* ======================================================== */}
      <Modal
        isOpen={isPremiumOfferingsModalOpen}
        onClose={resetPremiumOfferingsForm}
        title={editingPremiumOfferingsId ? "Edit Action / Service" : "Add Action / Service"}
      >
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Title</label>
              <input
                type="text"
                value={premiumOfferingsForm.title || ''}
                onChange={(e) => setPremiumOfferingsForm({ ...premiumOfferingsForm, title: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                placeholder="e.g. Farming"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Subtitle</label>
              <input
                type="text"
                value={premiumOfferingsForm.subtitle || ''}
                onChange={(e) => setPremiumOfferingsForm({ ...premiumOfferingsForm, subtitle: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                placeholder="e.g. Tools"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Image</label>
              <div className="space-y-3">
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setUploading(true);
                      setUploadProgress(0);
                      try {
                        const response = await serviceService.uploadImage(file, 'premium', (progress) => {
                          setUploadProgress(progress);
                        });
                        if (response.success) {
                          setPremiumOfferingsForm((p) => ({ ...p, imageUrl: response.imageUrl }));
                          toast.success("Image uploaded!");
                        }
                      } catch (error) {
                        console.error('Upload error:', error);
                        const msg = error.response?.data?.message || error.message || "Failed to upload image";
                        toast.error(msg);
                      } finally {
                        setUploading(false);
                        setUploadProgress(0);
                      }
                    }
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {uploading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-blue-600 text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        Uploading...
                      </div>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-blue-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-blue-600 h-full transition-all duration-300 ease-out"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                {premiumOfferingsForm.imageUrl && !uploading && (
                  <div className="relative inline-block group mt-1">
                    <img src={premiumOfferingsForm.imageUrl} alt="Preview" className="h-20 w-20 object-cover rounded-xl border border-gray-200 shadow-sm" />
                    <button
                      type="button"
                      onClick={() => setPremiumOfferingsForm({ ...premiumOfferingsForm, imageUrl: '' })}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      title="Remove image"
                    >
                      <FiX className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Action Type</label>
              <select
                value={premiumOfferingsForm.actionType}
                onChange={(e) => setPremiumOfferingsForm({ ...premiumOfferingsForm, actionType: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
              >
                <option value="setActiveSectionTab">Category Section Tab (Filters by Title)</option>
                <option value="navigate">Navigate to Page / Route</option>
              </select>
            </div>
            {premiumOfferingsForm.actionType === 'navigate' && (
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Route</label>
                <input
                  type="text"
                  value={premiumOfferingsForm.route || ''}
                  onChange={(e) => setPremiumOfferingsForm({ ...premiumOfferingsForm, route: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  placeholder="e.g. /user/agri-marketplace"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
            <button
              onClick={savePremiumOfferings}
              disabled={isSyncing}
              className="px-6 py-3.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-all shadow-md shadow-blue-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSyncing ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : <FiSave className="w-5 h-5" />}
              {isSyncing ? "Saving..." : (editingPremiumOfferingsId ? "Update Action" : "Add Action")}
            </button>
            <button
              onClick={resetPremiumOfferingsForm}
              disabled={isSyncing}
              className="px-6 py-3.5 text-gray-700 rounded-xl font-medium hover:bg-gray-100 transition-all border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 3: Equipment Curations Modal                       */}
      {/* ======================================================== */}
      <Modal
        isOpen={isCuratedModalOpen}
        onClose={resetCuratedForm}
        title={editingCuratedId ? "Edit Curated Service" : "Add Curated Service"}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-base font-bold text-gray-900 mb-2">Title</label>
            <input
              value={curatedForm.title}
              onChange={(e) => setCuratedForm((p) => ({ ...p, title: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-white"
              placeholder="Tractor Maintenance & Repair"
            />
          </div>
          <div>
            <label className="block text-base font-bold text-gray-900 mb-2">GIF/Video</label>
            <div className="space-y-3">
              <input
                type="file"
                accept="image/gif,video/*"
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setUploading(true);
                    setUploadProgress(0);
                    try {
                      const response = await serviceService.uploadImage(file, 'curated', (progress) => {
                        setUploadProgress(progress);
                      });
                      if (response.success) {
                        setCuratedForm((p) => ({ ...p, gifUrl: response.imageUrl }));
                        toast.success("Media uploaded!");
                      }
                    } catch (error) {
                      console.error('Curated upload error:', error);
                      toast.error("Failed to upload image/video");
                    } finally {
                      setUploading(false);
                      setUploadProgress(0);
                    }
                  }
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {uploading && (
                <div className="space-y-2 mt-2">
                  <div className="flex items-center justify-between text-blue-600 text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      Uploading...
                    </div>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-blue-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
              {curatedForm.gifUrl && !uploading && (
                <div className="mt-3 relative inline-block group">
                  {curatedForm.gifUrl.match(/\.(gif|webp)$/i) ? (
                    <img src={curatedForm.gifUrl} alt="Preview" className="h-32 w-auto object-cover rounded-lg border border-gray-200" />
                  ) : (
                    <video src={curatedForm.gifUrl} className="h-32 w-auto object-cover rounded-lg border border-gray-200" controls />
                  )}
                  <button
                    onClick={() => setCuratedForm(p => ({ ...p, gifUrl: "" }))}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove media"
                  >
                    <FiTrash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-base font-bold text-gray-900 mb-2">YouTube URL</label>
            <input
              value={curatedForm.youtubeUrl}
              onChange={(e) => setCuratedForm((p) => ({ ...p, youtubeUrl: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-white"
              placeholder="https://youtube.com/..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={saveCurated}
              disabled={uploading || isSyncing}
              className={`flex-1 py-3.5 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg ${(uploading || isSyncing) ? 'opacity-50 cursor-not-allowed bg-gray-400' : ''}`}
              style={{ backgroundColor: (uploading || isSyncing) ? '#cbd5e1' : '#2874F0' }}
            >
              {(uploading || isSyncing) ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : <FiSave className="w-5 h-5" />}
              {uploading ? "Uploading..." : isSyncing ? "Saving..." : (editingCuratedId ? "Update Curated Service" : "Add Curated Service")}
            </button>
            <button
              onClick={resetCuratedForm}
              disabled={isSyncing}
              className="px-6 py-3.5 text-gray-700 rounded-xl font-medium hover:bg-gray-100 transition-all border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 4: New & Noteworthy Modal                          */}
      {/* ======================================================== */}
      <Modal
        isOpen={isNoteworthyModalOpen}
        onClose={resetNoteworthyForm}
        title={editingNoteworthyId ? "Edit New & Noteworthy" : "Add New & Noteworthy"}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-base font-bold text-gray-900 mb-2">Title</label>
            <input
              value={noteworthyForm.title}
              onChange={(e) => setNoteworthyForm((p) => ({ ...p, title: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-white"
              placeholder="Crop Care & Protection"
            />
          </div>
          <div>
            <label className="block text-base font-bold text-gray-900 mb-2">Image</label>
            <div className="space-y-3">
              <input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setUploading(true);
                    setUploadProgress(0);
                    try {
                      const response = await serviceService.uploadImage(file, 'noteworthy', (progress) => {
                        setUploadProgress(progress);
                      });
                      if (response.success) {
                        setNoteworthyForm((p) => ({ ...p, imageUrl: response.imageUrl }));
                        toast.success("Image uploaded!");
                      }
                    } catch (error) {
                      console.error('Noteworthy upload error:', error);
                      const msg = error.response?.data?.message || error.message || "Failed to upload image";
                      toast.error(msg);
                    } finally {
                      setUploading(false);
                      setUploadProgress(0);
                    }
                  }
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {uploading && (
                <div className="space-y-2 mt-2">
                  <div className="flex items-center justify-between text-blue-600 text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      Uploading...
                    </div>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-blue-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
              {noteworthyForm.imageUrl && !uploading && (
                <div className="relative inline-block group">
                  <img src={noteworthyForm.imageUrl} alt="Preview" className="h-24 w-auto object-cover rounded-lg border border-gray-200 shadow-sm" />
                  <button
                    onClick={() => setNoteworthyForm(p => ({ ...p, imageUrl: "" }))}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove image"
                  >
                    <FiTrash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <RedirectionSelector
            categories={categories}
            allServices={allServices}
            targetCategoryId={noteworthyForm.targetCategoryId}
            slug={noteworthyForm.slug}
            onChange={(patch) => setNoteworthyForm((p) => ({ ...p, ...patch }))}
            label="Redirect to..."
          />

          <div className="flex gap-3 pt-4">
            <button
              onClick={saveNoteworthy}
              disabled={uploading || isSyncing}
              className={`flex-1 py-3.5 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg ${(uploading || isSyncing) ? 'opacity-50 cursor-not-allowed bg-gray-400' : ''}`}
              style={{ backgroundColor: (uploading || isSyncing) ? '#cbd5e1' : '#2874F0' }}
            >
              {(uploading || isSyncing) ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : <FiSave className="w-5 h-5" />}
              {uploading ? "Uploading..." : isSyncing ? "Saving..." : (editingNoteworthyId ? "Update" : "Add")}
            </button>
            <button
              onClick={resetNoteworthyForm}
              disabled={isSyncing}
              className="px-6 py-3.5 text-gray-700 rounded-xl font-medium hover:bg-gray-100 transition-all border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default HomePage;

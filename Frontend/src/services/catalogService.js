import api, { apiCache } from './api';
import { uploadToCloudinary } from '../utils/cloudinaryUpload';

/**
 * Catalog Service
 * Handles all API calls for Categories, Brands (formerly Services), Services (Sub-services), and Home Content
 */

/**
 * Category API calls
 */
export const categoryService = {
  // Get all categories
  getAll: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.append('status', params.status);
    if (params.showOnHome !== undefined) queryParams.append('showOnHome', params.showOnHome);
    if (params.isPopular !== undefined) queryParams.append('isPopular', params.isPopular);
    if (params.cityId) queryParams.append('cityId', params.cityId);

    const response = await api.get(`/admin/categories${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
    return response.data;
  },

  // Get single category by ID
  getById: async (id) => {
    const response = await api.get(`/admin/categories/${id}`);
    return response.data;
  },

  // Create new category
  create: async (data) => {
    const response = await api.post('/admin/categories', data);
    broadcastCategoryChangeClient();
    return response.data;
  },

  // Update category
  update: async (id, data) => {
    const response = await api.put(`/admin/categories/${id}`, data);
    broadcastCategoryChangeClient();
    return response.data;
  },

  // Delete category
  delete: async (id) => {
    const response = await api.delete(`/admin/categories/${id}`);
    broadcastCategoryChangeClient();
    return response.data;
  },

  // Update category order
  updateOrder: async (id, homeOrder) => {
    const response = await api.patch(`/admin/categories/${id}/order`, { homeOrder });
    broadcastCategoryChangeClient();
    return response.data;
  }
};

const broadcastCategoryChangeClient = () => {
  try {
    apiCache.invalidatePrefix('public:');
    localStorage.removeItem('cached_home_categories');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('categories_updated', { detail: { timestamp: Date.now() } }));
      if (window.BroadcastChannel) {
        const bc = new BroadcastChannel('groo_catalog_sync');
        bc.postMessage({ type: 'CATEGORIES_UPDATED', timestamp: Date.now() });
        bc.close();
      }
    }
  } catch (e) {
    console.warn('Category broadcast error:', e);
  }
};

/**
 * Brand API calls (Formerly Service)
 */
export const brandService = {
  // Get all brands
  getAll: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.append('status', params.status);
    if (params.categoryId) queryParams.append('categoryId', params.categoryId);
    if (params.cityId) queryParams.append('cityId', params.cityId);

    const response = await api.get(`/admin/brands${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
    return response.data;
  },

  // Get single brand by ID
  getById: async (id) => {
    const response = await api.get(`/admin/brands/${id}`);
    return response.data;
  },

  // Create new brand
  create: async (data) => {
    const response = await api.post('/admin/brands', data);
    return response.data;
  },

  // Update brand
  update: async (id, data) => {
    const response = await api.put(`/admin/brands/${id}`, data);
    return response.data;
  },

  // Delete brand
  delete: async (id) => {
    const response = await api.delete(`/admin/brands/${id}`);
    return response.data;
  },

  // Update brand page content
  updatePage: async (id, page) => {
    const response = await api.patch(`/admin/brands/${id}/page`, { page });
    return response.data;
  },

  // Upload brand image/video directly to Cloudinary
  uploadImage: async (file, folder = 'brands', onProgress) => {
    try {
      const url = await uploadToCloudinary(file, folder, onProgress);
      return {
        success: true,
        imageUrl: url,
        message: 'File uploaded successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to upload file',
        error: error.message
      };
    }
  }
};



/**
 * Service API calls (New Service Model - Child of Brand)
 */
export const serviceService = {
  // Get all services
  getAll: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.append('status', params.status);
    if (params.brandId) queryParams.append('brandId', params.brandId);
    if (params.categoryId) queryParams.append('categoryId', params.categoryId);

    const response = await api.get(`/admin/services${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
    return response.data;
  },

  // Get single service by ID
  getById: async (id) => {
    const response = await api.get(`/admin/services/${id}`);
    return response.data;
  },

  // Create new service
  create: async (data) => {
    const response = await api.post('/admin/services', data);
    return response.data;
  },

  // Update service
  update: async (id, data) => {
    const response = await api.put(`/admin/services/${id}`, data);
    return response.data;
  },

  // Delete service
  delete: async (id) => {
    const response = await api.delete(`/admin/services/${id}`);
    return response.data;
  },

  // Upload service image directly to Cloudinary
  uploadImage: async (file, folder = 'services', onProgress) => {
    try {
      const url = await uploadToCloudinary(file, folder, onProgress);
      return {
        success: true,
        imageUrl: url,
        message: 'File uploaded successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to upload file',
        error: error.message
      };
    }
  }
};

/**
 * Home Content API calls
 */
export const homeContentService = {
  // Get home content
  get: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.cityId) queryParams.append('cityId', params.cityId);

    const response = await api.get(`/admin/home-content${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
    return response.data;
  },

  // Update home content
  update: async (data, params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.cityId) queryParams.append('cityId', params.cityId);

    const response = await api.put(`/admin/home-content${queryParams.toString() ? `?${queryParams.toString()}` : ''}`, data);

    // Invalidate client caches and broadcast update across all tabs immediately
    try {
      apiCache.invalidatePrefix('public:');
      localStorage.removeItem('cached_home_content');

      const updateData = {
        cityId: null, // Broadcast globally to all city views
        homeContent: response.data?.homeContent,
        timestamp: Date.now()
      };

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('home_content_updated', { detail: updateData }));

        if (window.BroadcastChannel) {
          const bc = new BroadcastChannel('groo_catalog_sync');
          bc.postMessage({ type: 'HOME_CONTENT_UPDATED', ...updateData });
          bc.close();
        }
      }
    } catch (e) {
      console.warn('Catalog cache invalidation error:', e);
    }

    return response.data;
  }
};

/**
 * Public Catalog Service (for user app - no authentication required)
 * Now with caching for faster data retrieval
 */
export const publicCatalogService = {
  // Get all active categories (cached for 5 minutes)
  getCategories: async (params = {}) => {
    // Legacy support for passing cityId directly
    const normalizedParams = typeof params === 'string' ? { cityId: params } : params;

    const queryParams = new URLSearchParams();
    if (normalizedParams.cityId) queryParams.append('cityId', normalizedParams.cityId);
    if (normalizedParams.type) queryParams.append('type', normalizedParams.type);

    const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';
    const cacheKey = `public:categories:${queryStr || 'default'}`;
    const cached = apiCache.get(cacheKey);
    if (cached && !normalizedParams.forceRefresh) return cached;

    const response = await api.get(`/public/categories${queryStr}`);
    if (response.data.success) {
      apiCache.set(cacheKey, response.data, 30); // 30 seconds
    }
    return response.data;
  },

  // Get all active brands (formerly services)
  getBrands: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.categoryId) queryParams.append('categoryId', params.categoryId);
    if (params.categorySlug) queryParams.append('categorySlug', params.categorySlug);
    if (params.search) queryParams.append('search', params.search);
    if (params.cityId) queryParams.append('cityId', params.cityId);

    const cacheKey = `public:brands:${queryParams.toString()}`;
    const cached = apiCache.get(cacheKey);
    if (cached) return cached;

    const response = await api.get(`/public/brands${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
    if (response.data.success) {
      apiCache.set(cacheKey, response.data, 120); // 2 minutes
    }
    return response.data;
  },

  // Alias for backward compatibility if needed, but preferable to use getBrands
  getServices: async (params = {}) => {
    // New Service model endpoint
    const queryParams = new URLSearchParams();
    if (params.brandId) queryParams.append('brandId', params.brandId);
    if (params.brandSlug) queryParams.append('brandSlug', params.brandSlug);
    if (params.categoryId) queryParams.append('categoryId', params.categoryId);
    if (params.parentSourceId) queryParams.append('parentSourceId', params.parentSourceId);
    if (params.pricing_context) queryParams.append('pricing_context', params.pricing_context);
    if (params.search) queryParams.append('search', params.search);
    if (params.cityId) queryParams.append('cityId', params.cityId);

    const cacheKey = `public:services:${queryParams.toString()}`;
    if (!params.forceRefresh) {
      const cached = apiCache.get(cacheKey);
      if (cached) return cached;
    }

    const response = await api.get(`/public/services${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
    if (response.data.success) {
      apiCache.set(cacheKey, response.data, 30);
    }
    return response.data;
  },

  // Get brand by slug (cached for 1 minute)
  getBrandBySlug: async (slug, cityId) => {
    const cacheKey = `public:brand:${slug}:${cityId || 'default'}`;
    const cached = apiCache.get(cacheKey);
    if (cached) return cached;

    const query = cityId ? `?cityId=${cityId}` : '';
    const response = await api.get(`/public/brands/slug/${slug}${query}`);
    if (response.data.success) {
      apiCache.set(cacheKey, response.data, 60); // 1 minute
    }
    return response.data;
  },

  // Get home content (cached for 1 minute unless forceRefresh is true)
  getHomeContent: async (cityId, forceRefresh = false) => {
    const cacheKey = `public:homeContent:${cityId || 'default'}`;
    if (!forceRefresh) {
      const cached = apiCache.get(cacheKey);
      if (cached) return cached;
    }

    const query = cityId ? `?cityId=${cityId}` : '';
    const response = await api.get(`/public/home-content${query}`);
    if (response.data.success) {
      apiCache.set(cacheKey, response.data, 60); // 1 minute cache
    }
    return response.data;
  },

  // Invalidate all public caches (useful after admin updates)
  invalidateCache: () => {
    apiCache.invalidatePrefix('public:');
    try {
      localStorage.removeItem('cached_home_content');
      localStorage.removeItem('cached_home_categories');
    } catch {
      return false;
    }
  }
};


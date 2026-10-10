import api from './api';

const adminSchemeService = {
  // Get all schemes (Admin)
  getSchemes: async (params = {}) => {
    const response = await api.get('/admin/schemes', { params });
    return response.data;
  },

  // Get single scheme by ID
  getSchemeById: async (id) => {
    const response = await api.get(`/admin/schemes/${id}`);
    return response.data;
  },

  // Create new scheme
  createScheme: async (data) => {
    const response = await api.post('/admin/schemes', data);
    return response.data;
  },

  // Update existing scheme
  updateScheme: async (id, data) => {
    const response = await api.put(`/admin/schemes/${id}`, data);
    return response.data;
  },

  // Delete scheme
  deleteScheme: async (id) => {
    const response = await api.delete(`/admin/schemes/${id}`);
    return response.data;
  },

  // Toggle active status
  toggleSchemeStatus: async (id) => {
    const response = await api.patch(`/admin/schemes/${id}/toggle-status`);
    return response.data;
  },
};

export default adminSchemeService;

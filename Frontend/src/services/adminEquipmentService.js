import api from './api';

const adminEquipmentService = {
  getPending: async () => {
    const response = await api.get('/admin/equipment?status=pending');
    return response.data;
  },
  
  getAll: async (params) => {
    const response = await api.get('/admin/equipment', { params });
    return response.data;
  },

  updateStatus: async (id, data) => {
    const response = await api.patch(`/admin/equipment/${id}/status`, data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await api.put(`/admin/equipment/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/admin/equipment/${id}`);
    return response.data;
  }
};

export default adminEquipmentService;

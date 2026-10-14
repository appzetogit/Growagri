import api from './api';

const adminSoilTestService = {
    getAll: async () => {
        const response = await api.get('/admin/soil-tests');
        return response.data;
    },
    getSettings: async () => {
        const response = await api.get('/admin/soil-tests/settings');
        return response.data;
    },
    updateSettings: async (data) => {
        const response = await api.put('/admin/soil-tests/settings', data);
        return response.data;
    },
    update: async (id, data) => {
        const response = await api.put(`/admin/soil-tests/${id}`, data);
        return response.data;
    },
    delete: async (id) => {
        const response = await api.delete(`/admin/soil-tests/${id}`);
        return response.data;
    },
    assignVendor: async (id, vendorId) => {
        const response = await api.post(`/admin/soil-tests/${id}/assign`, { vendorId });
        return response.data;
    },
    approveReport: async (id, adminNotes) => {
        const response = await api.post(`/admin/soil-tests/${id}/approve`, { adminNotes });
        return response.data;
    },
    rejectReport: async (id, reason) => {
        const response = await api.post(`/admin/soil-tests/${id}/reject-report`, { reason });
        return response.data;
    },
    getVendors: async () => {
        const response = await api.get('/admin/vendors');
        return response.data;
    }
};

export default adminSoilTestService;

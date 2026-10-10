import api from './api';

const schemeService = {
  // Get all active schemes
  getPublicSchemes: async () => {
    const response = await api.get('/public/schemes');
    return response.data;
  },

  // Get scheme details by slug or ID
  getSchemeByIdentifier: async (identifier) => {
    const response = await api.get(`/public/schemes/${identifier}`);
    return response.data;
  },
};

export default schemeService;

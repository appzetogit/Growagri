import api from './api';

export const adminBookingService = {
  // Get all bookings with filters and search
  getAllBookings: async (params) => {
    try {
      const response = await api.get('/admin/bookings', { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch bookings' };
    }
  },

  // Get booking details by ID
  getBookingById: async (id) => {
    try {
      const response = await api.get(`/admin/bookings/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch booking details' };
    }
  },

  // Get booking analytics
  getAnalytics: async (filters = {}) => {
    try {
      const response = await api.get('/admin/bookings/analytics', { params: filters });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch analytics' };
    }
  },

  // Cancel booking
  cancelBooking: async (id, reason) => {
    try {
      const response = await api.post(`/admin/bookings/${id}/cancel`, { cancellationReason: reason });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to cancel booking' };
    }
  },

  // Force a booking into a status (admin override)
  overrideStatus: async (id, status, note) => {
    try {
      const response = await api.patch(`/admin/bookings/${id}/status`, { status, note });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to update status' };
    }
  },

  // Refund a paid booking to the customer's wallet (full when amount is empty)
  refundBooking: async (id, amount, reason) => {
    try {
      const response = await api.post(`/admin/bookings/${id}/refund`, { amount, reason });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to refund booking' };
    }
  },

  // Get bookings with KM photos for monitoring (fraud detection)
  getBookingsWithKmPhotos: async (params) => {
    try {
      const response = await api.get('/admin/bookings', {
        params: { ...params, hasKmPhotos: true }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch KM photo bookings' };
    }
  }
};

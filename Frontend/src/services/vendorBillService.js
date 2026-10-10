import api from './api';

/**
 * Vendor Bill Service
 * Handles final billing using catalog items and custom items
 */
const vendorBillService = {
  /**
   * Create or Update a bill for a booking
   */
  createOrUpdateBill: async (bookingId, billData) => {
    const response = await api.post(`/vendors/bookings/${bookingId}/bill`, billData);
    return response.data;
  },

  /**
   * Get bill details for a booking
   */
  getBill: async (bookingId) => {
    const response = await api.get(`/vendors/bookings/${bookingId}/bill`);
    return response.data;
  },

  /**
   * Download Invoice PDF
   */
  downloadInvoice: async (bookingId) => {
    const response = await api.get(`/vendors/bookings/${bookingId}/bill/download`, {
      responseType: 'blob'
    });
    return response.data;
  }
};

export default vendorBillService;

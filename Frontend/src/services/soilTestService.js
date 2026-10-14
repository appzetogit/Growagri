import api from './api';

const soilTestService = {
    getPrices: async () => {
        const response = await api.get('/user/soil-test/prices');
        return response.data;
    },
    // Pay & submit: paymentMethod 'wallet' submits immediately, 'online' returns a Razorpay order
    request: async (data) => {
        const response = await api.post('/user/soil-test/request', data);
        return response.data;
    },
    getMyRequests: async () => {
        const response = await api.get('/user/soil-test/my-requests');
        return response.data;
    },
    verifyPayment: async (id, data) => {
        const response = await api.post(`/user/soil-test/verify-payment/${id}`, data);
        return response.data;
    },
    update: async (id, data) => {
        const response = await api.put(`/user/soil-test/request/${id}`, data);
        return response.data;
    }
};

export default soilTestService;

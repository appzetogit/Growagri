import api from './api';

const disputeService = {
    // Raise a new dispute
    raiseDispute: (data) => api.post('/disputes', data),
};

export default disputeService;

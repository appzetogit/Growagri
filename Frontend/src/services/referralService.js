import API from './api';

const getReferralStats = async () => {
  const response = await API.get('/user/referral/stats');
  return response.data;
};

export const referralService = { getReferralStats };

const User = require('../../models/User');
const Transaction = require('../../models/Transaction');

/**
 * Generate a short unique referral code for a user
 */
const generateUniqueCode = async (name, phone) => {
  const nameSlug = (name || 'USER').replace(/\s+/g, '').toUpperCase().slice(0, 4);
  const phoneSuffix = (phone || '').slice(-4);
  let code = `${nameSlug}${phoneSuffix}`;

  // Check uniqueness, add random suffix if collision
  const exists = await User.findOne({ referralCode: code });
  if (exists) {
    code = `${nameSlug}${phoneSuffix}${Math.floor(Math.random() * 90 + 10)}`;
  }
  return code;
};

/**
 * Get user's own referral stats — code, total referred, total earned, history
 * If user has no referralCode (existing users), auto-generate and save one.
 */
const getReferralStats = async (req, res) => {
  try {
    const userId = req.user.id;

    let user = await User.findById(userId).select('referralCode totalReferrals name phone');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Auto-generate referral code for existing users who don't have one yet
    if (!user.referralCode) {
      const code = await generateUniqueCode(user.name, user.phone);
      user = await User.findByIdAndUpdate(
        userId,
        { referralCode: code },
        { new: true }
      ).select('referralCode totalReferrals name phone');
      console.log(`[REFERRAL] Auto-generated code for existing user ${userId}: ${code}`);
    }

    // Referred users list
    const referredUsers = await User.find({ referredBy: userId })
      .select('name createdAt')
      .sort({ createdAt: -1 })
      .limit(50);

    // Total earned from referrals
    const earningAgg = await Transaction.aggregate([
      { $match: { userId: user._id, type: 'referral_reward', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalEarned = earningAgg.length > 0 ? earningAgg[0].total : 0;

    res.status(200).json({
      success: true,
      data: {
        referralCode: user.referralCode,
        totalReferrals: user.totalReferrals || 0,
        totalEarned,
        referredUsers: referredUsers.map(u => ({
          name: u.name,
          joinedOn: u.createdAt
        }))
      }
    });
  } catch (error) {
    console.error('[Referral] getReferralStats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch referral stats' });
  }
};

module.exports = { getReferralStats };

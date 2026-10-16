import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

import { FiCopy, FiArrowLeft, FiGift, FiUsers, FiCheck } from 'react-icons/fi';
import { FaWhatsapp, FaFacebookMessenger } from 'react-icons/fa';
import { themeColors } from '../../../../theme';
import { referralService } from '../../../../services/referralService';

const Rewards = () => {
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await referralService.getReferralStats();
        if (res.success) setStats(res.data);
      } catch (err) {
        console.error('[Rewards] failed to load referral stats', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const getReferralLink = () => {
    const code = stats?.referralCode || '';
    return `${window.location.origin}/user/login?ref=${code}`;
  };

  const handleCopyLink = () => {
    const referralLink = getReferralLink();
    const copyText = async () => {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(referralLink);
        } else {
          const ta = document.createElement('textarea');
          ta.value = referralLink;
          ta.style.position = 'fixed';
          ta.style.left = '-999999px';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        setCopied(true);
        toast.success('Link copied! Paste it on WhatsApp to share.');
        setTimeout(() => setCopied(false), 3000);
      } catch {
        toast.error('Could not copy the link. Please copy it manually.');
      }
    };
    copyText();
  };

  const handleShareWhatsApp = () => {
    const url = getReferralLink();
    const code = stats?.referralCode || '';
    const text = `Join GrooAgri using my referral code: ${code}\n\nRegister using this link:\n${url}\n\nGet access to amazing farming services! 🌾`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleShareMessenger = () => {
    const url = getReferralLink();
    window.open(`https://www.facebook.com/dialog/send?link=${encodeURIComponent(url)}&app_id=123456789`, '_blank');
  };

  return (
    <div
      className="min-h-screen bg-white"
      style={{ background: themeColors.backgroundGradient }}
    >
      {/* Header */}
      <div className="bg-white sticky top-0 z-50 border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/user')}
            className="p-1.5 hover:bg-gray-50 rounded-full transition-colors"
          >
            <FiArrowLeft className="w-5 h-5 text-gray-800" />
          </button>
          <div className="flex items-center gap-2">
            <FiGift className="w-5 h-5" style={{ color: '#00A6A6' }} />
            <h1 className="text-lg font-bold text-gray-900">Refer &amp; Earn</h1>
          </div>
        </div>
      </div>

      <main>
        {/* Hero Section */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#00A6A6]/10 to-[#f0fdf4] px-4 py-6">
          <div className="flex items-start gap-3 mb-5">
            <div className="flex-1">
              <h2 className="text-lg font-bold text-black mb-2">
                Refer and get ₹100 in wallet!
              </h2>
              <p className="text-xs text-gray-600 leading-relaxed">
                Invite your friends to join GrooAgri. When they register using your code, you instantly get <span className="font-bold text-[#00A6A6]">₹100 in your wallet</span>.
              </p>
            </div>
            <div className="relative shrink-0">
              <div className="w-16 h-16 bg-yellow-400 rounded-lg flex items-center justify-center transform rotate-12 shadow-lg">
                <span className="text-3xl">🎁</span>
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-400 rounded-full" />
              <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-orange-300 rounded-full" />
            </div>
          </div>

          {/* Referral Code Display */}
          <div className="bg-white rounded-2xl border border-[#00A6A6]/20 p-4 mb-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">Your referral code</p>
            {loading ? (
              <div className="h-8 bg-gray-100 rounded-lg animate-pulse w-32" />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-extrabold tracking-widest text-[#00A6A6]">
                  {stats?.referralCode || '—'}
                </span>
                <button
                  onClick={handleCopyLink}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all"
                  style={{ backgroundColor: copied ? '#10b981' : '#00A6A6' }}
                >
                  {copied ? <FiCheck className="w-3.5 h-3.5" /> : <FiCopy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            )}
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
              <FiUsers className="w-5 h-5 text-[#00A6A6] mx-auto mb-1" />
              <p className="text-2xl font-extrabold text-gray-900">
                {loading ? '—' : (stats?.totalReferrals ?? 0)}
              </p>
              <p className="text-[10px] text-gray-500">Friends Referred</p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
              <FiGift className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
              <p className="text-2xl font-extrabold text-gray-900">
                {loading ? '—' : `₹${stats?.totalEarned ?? 0}`}
              </p>
              <p className="text-[10px] text-gray-500">Total Earned</p>
            </div>
          </div>

          {/* Share via */}
          <p className="text-xs font-semibold text-gray-600 mb-2">Refer via</p>
          <div className="flex gap-4">
            <button onClick={handleShareWhatsApp} className="flex flex-col items-center gap-1.5">
              <div className="w-12 h-12 bg-[#25D366] rounded-full flex items-center justify-center shadow-md">
                <FaWhatsapp className="w-6 h-6 text-white" />
              </div>
              <span className="text-[10px] text-gray-600">WhatsApp</span>
            </button>
            <button onClick={handleShareMessenger} className="flex flex-col items-center gap-1.5">
              <div className="w-12 h-12 bg-[#0084FF] rounded-full flex items-center justify-center shadow-md">
                <FaFacebookMessenger className="w-6 h-6 text-white" />
              </div>
              <span className="text-[10px] text-gray-600">Messenger</span>
            </button>
            <button onClick={handleCopyLink} className="flex flex-col items-center gap-1.5">
              <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-md" style={{ backgroundColor: '#00A6A6' }}>
                {copied ? <FiCheck className="w-6 h-6 text-white" /> : <FiCopy className="w-6 h-6 text-white" />}
              </div>
              <span className="text-[10px] text-gray-600">Copy Link</span>
            </button>
          </div>
        </div>

        {/* How it works */}
        <div className="px-4 py-4 bg-white rounded-t-3xl shadow-sm border-t border-gray-100">
          <h3 className="text-base font-bold text-black mb-3">How it works?</h3>
          <div className="relative pl-7">
            <div className="absolute left-3.5 top-0 bottom-0 w-0.5 bg-gray-200" />
            {[
              'Share your referral code or link with a friend',
              'They register on GrooAgri using your code',
              'You instantly get ₹100 credited to your wallet 🎉',
            ].map((text, i) => (
              <div key={i} className="relative mb-4 last:mb-0">
                <div className="absolute -left-7 w-7 h-7 bg-[#00A6A6]/10 border border-[#00A6A6]/20 rounded-full flex items-center justify-center text-xs font-bold text-[#00A6A6]">
                  {i + 1}
                </div>
                <p className="text-xs text-gray-700">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Referred Friends List */}
        {!loading && stats?.referredUsers?.length > 0 && (
          <div className="px-4 py-4 bg-white border-t border-gray-100 mt-2">
            <h3 className="text-sm font-bold text-gray-800 mb-3">People you've referred</h3>
            <div className="space-y-2">
              {stats.referredUsers.map((u, i) => (
                <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-[#00A6A6]/10 flex items-center justify-center text-[#00A6A6] font-bold text-xs">
                    {u.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">{u.name}</p>
                    <p className="text-[10px] text-gray-400">
                      Joined {new Date(u.joinedOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-green-600 text-xs font-bold">
                    <FiCheck className="w-3 h-3" /> +₹100
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && (!stats?.referredUsers || stats.referredUsers.length === 0) && (
          <div className="px-4 py-4 bg-white border-t border-gray-100 mt-2">
            <h3 className="text-sm font-bold text-gray-800 mb-1">No referrals yet</h3>
            <p className="text-xs text-gray-400">Share your code and start earning ₹100 per referral!</p>
          </div>
        )}

        {/* T&C */}
        <div className="px-4 py-3 border-t border-gray-100 bg-white">
          <div className="flex items-center gap-2 text-[#00A6A6] text-xs">
            <span>•</span>
            <button onClick={() => navigate('/user/cancellation-policy')} className="hover:underline">Terms and conditions</button>
            <span>•</span>
            <button onClick={() => navigate('/user/help-support')} className="hover:underline">FAQs</button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Rewards;

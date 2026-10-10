import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiShield, FiCheckCircle } from 'react-icons/fi';
import { gsap } from 'gsap';
import api from '../../../../services/api';
import LogoLoader from '../../../../components/common/LogoLoader';

const PrivacyPolicy = () => {
    const navigate = useNavigate();
    const containerRef = useRef(null);
    const [policyData, setPolicyData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPolicy = async () => {
            try {
                setLoading(true);
                const res = await api.get('/content/policy/user/privacy');
                if (res.data?.success && res.data?.data) {
                    setPolicyData(res.data.data);
                }
            } catch (err) {
                console.error("Failed to fetch privacy policy:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchPolicy();
    }, []);

    useEffect(() => {
        if (!loading) {
            const ctx = gsap.context(() => {
                gsap.from('.animate-item', {
                    y: 20,
                    opacity: 0,
                    duration: 0.5,
                    stagger: 0.1,
                    ease: 'power2.out'
                });
            }, containerRef);
            return () => ctx.revert();
        }
    }, [loading]);

    const grooGradient = 'linear-gradient(135deg, #347989 0%, #BB5F36 100%)';
    const grooTextGradient = {
        background: grooGradient,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
    };

    if (loading) return <LogoLoader />;

    // Helper to parse numbered sections from database content
    const parsePolicySections = (text) => {
        if (!text) return [];
        // Split by numbered sections e.g. "1. ", "2. "
        const rawParts = text.split(/(?=\d+\.\s+)/g).filter(Boolean);
        return rawParts.map(part => {
            const lines = part.trim().split('\n');
            const title = lines[0].replace(/^\d+\.\s*/, '').trim();
            const body = lines.slice(1).join('\n').trim();
            return { title, body };
        });
    };

    const parsedSections = policyData?.content ? parsePolicySections(policyData.content) : [];

    return (
        <div ref={containerRef} className="min-h-screen bg-gray-50 pb-12">
            {/* Header */}
            <header className="bg-white/90 backdrop-blur-md shadow-sm sticky top-0 z-30 border-b border-gray-100">
                <div className="px-4 py-4 flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors active:scale-95"
                    >
                        <FiArrowLeft className="w-5 h-5 text-gray-700" />
                    </button>
                    <span className="text-xl font-black" style={grooTextGradient}>Privacy Policy</span>
                </div>
            </header>

            <main className="px-5 py-6 space-y-6 max-w-2xl mx-auto">
                {/* Hero */}
                <div className="animate-item bg-white rounded-[32px] p-6 text-center shadow-sm border border-gray-100">
                    <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-teal-100/50">
                        <FiShield className="w-8 h-8 text-teal-600" />
                    </div>
                    <h1 className="text-2xl font-black text-gray-900 mb-1">Your Privacy Matters</h1>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
                        GrooAgri is committed to maintaining complete transparency and protecting your agricultural data.
                    </p>
                </div>

                {/* Real Dynamic Policy Sections from Database */}
                <div className="space-y-4">
                    {parsedSections.length > 0 ? (
                        parsedSections.map((sec, idx) => (
                            <div key={idx} className="animate-item bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="w-7 h-7 rounded-full bg-teal-50 text-teal-700 text-xs font-black flex items-center justify-center border border-teal-100">
                                        {idx + 1}
                                    </span>
                                    <h3 className="font-bold text-gray-900 text-base">{sec.title}</h3>
                                </div>
                                <p className="text-xs text-gray-600 leading-relaxed pl-10 whitespace-pre-line">
                                    {sec.body}
                                </p>
                            </div>
                        ))
                    ) : policyData?.content ? (
                        <div className="animate-item bg-white rounded-3xl p-6 shadow-sm border border-gray-100 whitespace-pre-line text-sm text-gray-600 leading-relaxed">
                            {policyData.content}
                        </div>
                    ) : (
                        <div className="text-center py-10 text-gray-400 text-sm">
                            Privacy policy is being updated.
                        </div>
                    )}
                </div>

                {/* Trust Highlights */}
                <div className="animate-item bg-teal-900 rounded-[28px] p-6 text-white relative overflow-hidden shadow-lg">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-12 translate-x-12 blur-2xl pointer-events-none"></div>
                    <h3 className="text-base font-bold mb-3">Our Core Commitments</h3>
                    <ul className="space-y-2.5">
                        {[
                            'Zero unsolicited data sharing with third parties',
                            'End-to-end encrypted farmer and vendor transactions',
                            'Accurate field data protection for land records'
                        ].map((item, i) => (
                            <li key={i} className="flex items-center gap-2.5 text-xs text-teal-100">
                                <FiCheckCircle className="text-emerald-400 shrink-0 w-4 h-4" />
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Footer */}
                {policyData?.updatedAt && (
                    <div className="animate-item text-center pt-2 opacity-50">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500">
                            Last Updated: {new Date(policyData.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default PrivacyPolicy;

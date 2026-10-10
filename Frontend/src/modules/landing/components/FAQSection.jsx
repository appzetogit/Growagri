import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPlus, FiMinus, FiHelpCircle } from 'react-icons/fi';
import TranslatedText from '../../../components/TranslatedText';
import axios from 'axios';

const FAQSection = () => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [activeTab, setActiveTab] = useState('Farmer');
    const [faqs, setFaqs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const tabs = ['Farmer', 'Owner', 'General'];
    const API_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

    useEffect(() => {
        const fetchFAQs = async () => {
            try {
                const response = await axios.get(`${API_URL}/content/faq`);
                if (response.data.success && Array.isArray(response.data.data)) {
                    setFaqs(response.data.data);
                } else {
                    setFaqs([]);
                }
            } catch (error) {
                console.error("Error fetching FAQs:", error);
                setFaqs([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchFAQs();
    }, []);

    const filteredFaqs = faqs.filter(faq => faq.category === activeTab);

    return (
        <section id="faq" className="py-12 md:py-24 bg-white relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-green-50 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl opacity-50 z-0" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-50 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl opacity-50 z-0" />

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="text-center mb-8 md:mb-12">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <span className="text-green-600 font-black tracking-widest uppercase text-xs mb-3 block">
                            <TranslatedText>Support Center</TranslatedText>
                        </span>
                        <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-6 leading-tight">
                            <TranslatedText>Frequently Asked Questions</TranslatedText>
                        </h2>
                        <div className="h-1.5 w-20 bg-green-600 mx-auto rounded-full mb-8" />
                        
                        {/* Tab Selector */}
                        <div className="flex items-center justify-center p-1 bg-gray-100 rounded-2xl max-w-sm mx-auto mb-10 overflow-x-auto no-scrollbar">
                            {tabs.map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => {
                                        setActiveTab(tab);
                                        setActiveIndex(0); // Reset accordion to first item in new tab
                                    }}
                                    className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                                        activeTab === tab 
                                        ? 'bg-white text-green-600 shadow-md transform scale-[1.02]' 
                                        : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    <TranslatedText>{tab}</TranslatedText>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                </div>

                <div className="space-y-4 min-h-[400px]">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-4"
                        >
                            {filteredFaqs.map((faq, idx) => (
                                <motion.div
                                    key={`${activeTab}-${idx}`}
                                    className={`group border rounded-3xl transition-all duration-300 ${activeIndex === idx
                                            ? 'border-green-500 bg-white ring-8 ring-green-50 shadow-2xl shadow-green-900/5'
                                            : 'border-gray-100 bg-gray-50/50 hover:bg-white hover:border-green-200'
                                        }`}
                                >
                                    <button
                                        onClick={() => setActiveIndex(activeIndex === idx ? -1 : idx)}
                                        className="w-full px-6 py-6 md:px-8 flex items-center justify-between text-left focus:outline-none"
                                    >
                                        <div className="flex items-center gap-4 md:gap-6 min-w-0">
                                            <div className={`hidden sm:flex w-10 h-10 rounded-2xl items-center justify-center shrink-0 transition-colors ${activeIndex === idx ? 'bg-green-600 text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}>
                                                <FiHelpCircle size={18} />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className={`font-bold text-gray-900 text-sm md:text-base transition-colors leading-snug ${activeIndex === idx ? 'text-green-600' : 'group-hover:text-green-600'}`}>
                                                    <TranslatedText>{faq.question}</TranslatedText>
                                                </h4>
                                            </div>
                                        </div>
                                        <div className={`flex-shrink-0 transition-all duration-500 ml-4 hidden sm:block ${activeIndex === idx ? 'rotate-180 bg-green-600 text-white shadow-md' : 'bg-white text-gray-400 border border-gray-100'} w-8 h-8 rounded-full flex items-center justify-center`}>
                                            <FiPlus className={activeIndex === idx ? 'rotate-45 text-white' : 'text-gray-400'} size={14} />
                                        </div>
                                    </button>

                                    <AnimatePresence>
                                        {activeIndex === idx && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.4, ease: "easeOut" }}
                                            >
                                                <div className="px-6 pb-6 md:px-8 md:pl-24 text-gray-600 leading-relaxed text-sm border-t border-gray-50 pt-6">
                                                    <div className="bg-white rounded-2xl shadow-inner border border-green-50 p-4 md:p-6 italic relative overflow-hidden">
                                                        <div className="absolute top-0 right-0 opacity-5 -translate-y-2">
                                                            <FiHelpCircle size={80} />
                                                        </div>
                                                        <TranslatedText>{faq.answer}</TranslatedText>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            ))}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </section>
    );
};

export default FAQSection;

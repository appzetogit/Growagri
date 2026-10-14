import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiArrowLeft, FiSearch, FiMail, FiPhone,
  FiChevronRight, FiHelpCircle, FiBook, FiAlertCircle,
  FiCheckCircle, FiClock, FiSend
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import api from '../../../../services/api';

const HelpSupport = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showContactForm, setShowContactForm] = useState(false);
  const [supportInfo, setSupportInfo] = useState({
    email: 'grooagri@gmail.com',
    phone: '+91 91177 04450',
    whatsapp: '+91 91177 04450'
  });

  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [configRes, faqRes] = await Promise.all([
          api.get('/public/config').catch(() => null),
          api.get('/content/faq').catch(() => null)
        ]);

        if (configRes?.data?.success && configRes?.data?.settings) {
          const { supportEmail, supportPhone, supportWhatsapp } = configRes.data.settings;
          setSupportInfo({
            email: supportEmail || 'grooagri@gmail.com',
            phone: supportPhone || '+91 91177 04450',
            whatsapp: supportWhatsapp || '+91 91177 04450'
          });
        }

        if (faqRes?.data?.success && faqRes.data.data) {
          // Filter out 'Owner' FAQs for the farmer app
          const backendFaqs = faqRes.data.data.filter(faq => faq.category !== 'Owner');

          const grouped = backendFaqs.reduce((acc, curr) => {
            const cat = curr.category || 'General';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push({ q: curr.question, a: curr.answer });
            return acc;
          }, {});

          const newCategories = Object.keys(grouped).map(cat => {
            let icon = FiHelpCircle;
            let color = '#3B82F6';
            if (cat === 'Farmer') { icon = FiBook; color = '#10B981'; }

            return {
              id: cat.toLowerCase(),
              title: cat + ' FAQs',
              icon,
              color,
              questions: grouped[cat]
            };
          });

          if (newCategories.length > 0) {
            setCategories(newCategories);
          }
        }
      } catch (error) {
        console.error('Failed to fetch support data:', error);
      }
    };
    fetchData();
  }, []);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });


  // Quick actions
  const quickActions = [
    {
      id: 'email',
      title: 'Email Us',
      subtitle: supportInfo.email,
      icon: FiMail,
      color: '#10B981',
      action: () => {
        window.location.href = `mailto:${supportInfo.email}`;
      }
    },
    {
      id: 'call',
      title: 'Call Us',
      subtitle: supportInfo.phone || 'Not Available',
      icon: FiPhone,
      color: '#F59E0B',
      action: () => {
        if (supportInfo.phone) {
          window.location.href = `tel:${supportInfo.phone}`;
        } else {
          toast.info('Phone support is currently unavailable');
        }
      }
    },
  ];

  const handleContactSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      const response = await api.post('/support/submit', formData);
      if (response.data.success) {
        toast.success(response.data.message || 'Your message has been sent! We\'ll get back to you soon.');
        setShowContactForm(false);
        setFormData({ name: '', email: '', subject: '', message: '' });
      }
    } catch (error) {
      console.error('Support submit error:', error);
      toast.error(error.response?.data?.message || 'Failed to send message. Please try again.');
    }
  };

  const filteredQuestions = categories.flatMap(cat =>
    cat.questions.filter(q =>
      searchQuery === '' ||
      q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.a.toLowerCase().includes(searchQuery.toLowerCase())
    ).map(q => ({ ...q, category: cat.title, color: cat.color }))
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white shadow-sm">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.history.state && window.history.state.idx > 0 ? navigate(-1) : navigate('/user')}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <FiArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">Help & Support</h1>
          </div>
        </div>
      </div>

      <main className="px-4 pt-4">
        {/* Quick Actions */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Contact Us</h2>
          <div className="grid grid-cols-1 gap-3">
            {quickActions.map(action => {
              let href = null;
              if (action.id === 'email' && supportInfo.email) {
                href = `mailto:${supportInfo.email}`;
              } else if (action.id === 'call' && supportInfo.phone) {
                href = `tel:${supportInfo.phone.replace(/\D/g, '')}`;
              }

              const Component = href ? 'a' : 'button';

              return (
                <Component
                  key={action.id}
                  href={href}
                  onClick={!href ? action.action : undefined}
                  className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all active:scale-98 border border-gray-100 flex items-center gap-4 w-full"
                >
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${action.color}15` }}
                  >
                    <action.icon className="w-6 h-6" style={{ color: action.color }} />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-semibold text-gray-900">{action.title}</h3>
                    <p className="text-sm text-gray-600">{action.subtitle}</p>
                  </div>
                  <FiChevronRight className="w-5 h-5 text-gray-400" />
                </Component>
              );
            })}
          </div>
        </div>

        {/* Submit a Request Button */}
        <button
          onClick={() => setShowContactForm(true)}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl p-4 font-semibold shadow-lg hover:shadow-xl transition-all active:scale-98 mb-6 flex items-center justify-center gap-2"
        >
          <FiSend className="w-5 h-5" />
          Submit a Request
        </button>

        {/* Search Results */}
        {searchQuery !== '' && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">
              Search Results ({filteredQuestions.length})
            </h2>
            {filteredQuestions.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center">
                <FiAlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600">No results found for "{searchQuery}"</p>
                <p className="text-sm text-gray-500 mt-2">Try different keywords or contact support</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredQuestions.map((item, idx) => (
                  <div key={idx} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-start gap-2 mb-2">
                      <span
                        className="text-xs font-semibold px-2 py-1 rounded-full"
                        style={{
                          backgroundColor: `${item.color}15`,
                          color: item.color
                        }}
                      >
                        {item.category}
                      </span>
                    </div>
                    <div className="flex items-start gap-2 mb-2">
                      <FiHelpCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="font-medium text-gray-900 text-sm">{item.q}</p>
                    </div>
                    <p className="text-sm text-gray-600 ml-6">{item.a}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Contact Form Modal */}
      {showContactForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Submit a Request</h2>
                <button
                  onClick={() => setShowContactForm(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <FiArrowLeft className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleContactSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                  placeholder="your.email@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                  placeholder="Brief description of your issue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  rows={6}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none resize-none"
                  placeholder="Describe your issue in detail..."
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl p-4 font-semibold shadow-lg hover:shadow-xl transition-all active:scale-98 flex items-center justify-center gap-2"
              >
                <FiSend className="w-5 h-5" />
                Submit Request
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HelpSupport;

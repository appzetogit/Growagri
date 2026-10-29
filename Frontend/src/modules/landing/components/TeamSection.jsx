import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiUser, FiLinkedin, FiTwitter, FiMail } from 'react-icons/fi';
import axios from 'axios';
import TranslatedText from '../../../components/TranslatedText';

// Fallback seed team members in case API is loading or offline
const DEFAULT_MEMBERS = [
  {
    _id: 'default-1',
    name: 'Chinmay Anand',
    role: 'Founder & CEO',
    image: '',
    bio: 'Designated Partner at GLOBAL RURAL OUTREACH ORGANISATION LLP. Transforming agriculture through technology.',
    order: 1,
    isActive: true,
  },
  {
    _id: 'default-2',
    name: 'Ifat Khanam',
    role: 'Co-Founder',
    image: '',
    bio: 'Designated Partner at GLOBAL RURAL OUTREACH ORGANISATION LLP. Driving farm mechanization and smart agritech.',
    order: 2,
    isActive: true,
  },
];

const TeamSection = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchTeam = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
        const res = await axios.get(`${baseUrl}/public/website/team-members`);
        if (isMounted) {
          if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
            setMembers(res.data.data.filter((m) => m.isActive));
          } else {
            setMembers(DEFAULT_MEMBERS);
          }
        }
      } catch (err) {
        console.warn('Could not fetch team members from backend, using default fallback:', err);
        if (isMounted) {
          setMembers(DEFAULT_MEMBERS);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchTeam();
    return () => {
      isMounted = false;
    };
  }, []);

  const displayList = members.length > 0 ? members : DEFAULT_MEMBERS;

  return (
    <div className="mb-20">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <span className="inline-block text-xs text-green-700 font-bold tracking-[0.25em] uppercase mb-2">
            <TranslatedText>Leadership & Vision</TranslatedText>
          </span>
          <h3 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tight mb-3">
            <TranslatedText>Our Team Members</TranslatedText>
          </h3>
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: '4rem' }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="h-1 bg-green-500 rounded-full mx-auto mb-4"
          />
          <p className="text-sm md:text-base text-gray-600 leading-relaxed font-medium max-w-2xl mx-auto">
            <TranslatedText>
              Meet the visionary innovators, agricultural leaders, and domain experts driving India's farm mechanization forward.
            </TranslatedText>
          </p>
        </motion.div>
      </div>

      {/* Grid of Team Members */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
        {displayList.map((member, index) => (
          <motion.div
            key={member._id || index}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
            whileHover={{ y: -6 }}
            className="group bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:border-green-200 transition-all duration-300 flex flex-col items-center text-center relative overflow-hidden"
          >
            {/* Subtle background decoration */}
            <div className="absolute -top-12 -right-12 w-28 h-28 bg-green-50 rounded-full blur-2xl group-hover:bg-green-100 transition-colors pointer-events-none" />

            {/* Profile Picture */}
            <div className="relative mb-5 z-10">
              <div className="w-28 h-28 rounded-full p-1 bg-gradient-to-tr from-green-500 via-emerald-400 to-green-600 shadow-md group-hover:scale-105 transition-transform duration-300">
                <div className="w-full h-full rounded-full overflow-hidden bg-white flex items-center justify-center">
                  {member.image ? (
                    <img
                      src={member.image}
                      alt={member.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center text-green-700 font-black text-2xl">
                      {member.name
                        ? member.name
                            .split(' ')
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()
                        : <FiUser className="w-8 h-8 text-green-600" />}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Member Name */}
            <h4 className="text-lg font-black text-gray-900 mb-1 tracking-tight group-hover:text-green-700 transition-colors z-10">
              {member.name}
            </h4>

            {/* Role Badge */}
            <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200 mb-3 z-10">
              <TranslatedText>{member.role}</TranslatedText>
            </div>

            {/* Bio / Description */}
            {member.bio && (
              <p className="text-xs text-gray-500 leading-relaxed font-medium line-clamp-3 mb-4 italic z-10">
                "{member.bio}"
              </p>
            )}

            {/* Social Links */}
            {(member.socialLinks?.linkedin || member.socialLinks?.twitter || member.socialLinks?.email) && (
              <div className="flex items-center gap-2 mt-auto pt-3 border-t border-gray-100 w-full justify-center z-10 text-gray-400">
                {member.socialLinks?.linkedin && (
                  <a
                    href={member.socialLinks.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="LinkedIn"
                  >
                    <FiLinkedin className="w-4 h-4" />
                  </a>
                )}
                {member.socialLinks?.twitter && (
                  <a
                    href={member.socialLinks.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl hover:text-sky-500 hover:bg-sky-50 transition-colors"
                    title="Twitter / X"
                  >
                    <FiTwitter className="w-4 h-4" />
                  </a>
                )}
                {member.socialLinks?.email && (
                  <a
                    href={`mailto:${member.socialLinks.email}`}
                    className="p-2 rounded-xl hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Email"
                  >
                    <FiMail className="w-4 h-4" />
                  </a>
                )}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default TeamSection;

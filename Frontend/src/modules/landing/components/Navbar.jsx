import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HiMenu, HiX, HiTranslate } from 'react-icons/hi';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../../../context/LanguageContext';
import TranslatedText from '../../../components/TranslatedText';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  const isLightPage = location.pathname !== '/';
  const { language, languages, changeLanguage, isChangingLanguage } = useLanguage();
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const dropdownRef = React.useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowLanguageDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { id: 'home', name: <TranslatedText>Home</TranslatedText>, href: '/', isAnchor: false },
    { id: 'about', name: <TranslatedText>About</TranslatedText>, href: '/about', isAnchor: false },
    { id: 'services', name: <TranslatedText>Services</TranslatedText>, href: '/services', isAnchor: false },
    { id: 'blogs', name: <TranslatedText>Blogs</TranslatedText>, href: '/blogs', isAnchor: false },
    { id: 'articles', name: <TranslatedText>Articles</TranslatedText>, href: '/articles', isAnchor: false },
    { id: 'faq', name: <TranslatedText>FAQ</TranslatedText>, href: '/faq', isAnchor: false },
  ];

  const handleNavClick = (e, link) => {
    // Check if we need to do an internal smooth scroll
    if (link.isAnchor && location.pathname === '/') {
      e.preventDefault();
      const targetId = link.href.split('#')[1];
      const targetElement = document.getElementById(targetId);
      
      setIsOpen(false);

      if (targetElement) {
        // Wait for the menu closing animation to finish slightly
        setTimeout(() => {
          const navHeight = 80;
          const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - navHeight;
          
          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
          
          // Update URL hash without jump
          window.history.pushState(null, null, link.href);
        }, 350);
      }
    } else {
      setIsOpen(false);
    }
  };

  return (
    <nav
      className={`fixed w-full z-50 transition-all duration-300 ${(isScrolled || isLightPage) ? 'bg-white shadow-md py-2' : 'bg-transparent py-4'
        }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`flex justify-between items-center transition-all duration-300 ${(isScrolled || isLightPage) ? 'h-16' : 'h-20'}`}>
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="flex items-center">
              <img
                src="/logo.png"
                alt="Groo Logo"
                className={`w-auto object-contain transition-all duration-300 hover:scale-105 ${
                  (isScrolled || isLightPage) ? 'h-14 md:h-16' : 'h-16 md:h-20'
                }`}
              />
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-6">
            <div className="flex items-center space-x-6 mr-4">
              {navLinks.map((link, idx) => (
                <Link
                  key={idx}
                  to={link.href}
                  onClick={(e) => handleNavClick(e, link)}
                  className={`text-sm font-medium transition-colors hover:text-yellow-500 ${(isScrolled || isLightPage) ? 'text-gray-700' : 'text-white'
                    }`}
                >
                  {link.name}
                </Link>
              ))}
            </div>

            <div className="flex items-center space-x-3">
              {/* Language Selector */}
              <div className="relative group mr-2" ref={dropdownRef}>
                <button
                  onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                  className={`flex items-center space-x-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${(isScrolled || isLightPage)
                    ? 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    : 'border-white/30 text-white hover:bg-white/10'
                    } ${showLanguageDropdown ? 'bg-green-50/10' : ''}`}
                >
                  <HiTranslate size={16} className={isChangingLanguage ? 'animate-spin' : ''} />
                  <span>{languages[language]?.flag} {language}</span>
                </button>
                
                <AnimatePresence>
                  {showLanguageDropdown && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-[100] overflow-hidden"
                    >
                      <div className="px-4 py-2 text-[10px] uppercase tracking-wider text-gray-400 font-bold border-b border-gray-50 mb-1">
                        Select Language
                      </div>
                      {Object.keys(languages).map((lang) => (
                        <button
                          key={lang}
                          onClick={() => {
                            changeLanguage(lang);
                            setShowLanguageDropdown(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 text-xs hover:bg-green-50 transition-colors flex items-center justify-between ${language === lang ? 'text-green-700 font-bold bg-green-50/50' : 'text-gray-700'
                            }`}
                        >
                          <div className="flex items-center space-x-2">
                             <span className="text-base">{languages[lang].flag}</span>
                             <span>{lang}</span>
                          </div>
                          {language === lang && <div className="w-1.5 h-1.5 rounded-full bg-green-600"></div>}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <Link
                to="/user/login"
                className="bg-green-700 text-white px-5 py-2 rounded-full text-xs font-bold hover:bg-green-800 transition-colors shadow-lg"
              >
                <TranslatedText>Join as User</TranslatedText>
              </Link>
              <Link
                to="/vendor/login"
                className={`px-5 py-2 rounded-full text-xs font-bold transition-all border ${(isScrolled || isLightPage) ? 'border-green-700 text-green-700 hover:bg-green-50' : 'border-white text-white hover:bg-white/10'
                  }`}
              >
                <TranslatedText>Join as Vendor</TranslatedText>
              </Link>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center space-x-4">
            {/* Mobile Language Icon */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                className={`p-2 rounded-full border ${(isScrolled || isLightPage) ? 'border-gray-200 text-gray-700' : 'border-white/30 text-white'} ${showLanguageDropdown ? 'bg-white/20' : ''}`}
              >
                <HiTranslate size={20} className={isChangingLanguage ? 'animate-spin' : ''} />
              </button>
              
              <AnimatePresence>
                {showLanguageDropdown && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                    className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-2xl border border-gray-100 py-1 z-[100]"
                  >
                    {Object.keys(languages).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => {
                          changeLanguage(lang);
                          setShowLanguageDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-3 text-xs flex items-center space-x-3 transition-colors ${language === lang ? 'text-green-700 font-bold bg-green-50' : 'text-gray-700 active:bg-gray-50'}`}
                      >
                        <span className="text-base">{languages[lang].flag}</span>
                        <span>{lang}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={() => setIsOpen(!isOpen)}
              className={`p-2 rounded-md ${(isScrolled || isLightPage) ? 'text-gray-700' : 'text-white'}`}
            >
              {isOpen ? <HiX size={28} /> : <HiMenu size={28} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-gray-100 overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-1 sm:px-3">
              {navLinks.map((link, idx) => (
                <Link
                  key={idx}
                  to={link.href}
                  className="block px-3 py-3 text-base font-medium text-gray-700 hover:text-green-700 hover:bg-gray-50 rounded-md"
                  onClick={(e) => handleNavClick(e, link)}
                >
                  {link.name}
                </Link>
              ))}

              <div className="flex flex-wrap gap-2 px-3 py-4 border-y border-gray-100">
                {Object.keys(languages).slice(0, 5).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => changeLanguage(lang)}
                    className={`px-3 py-1.5 rounded-full text-xs border ${language === lang ? 'bg-green-700 text-white border-green-700' : 'border-gray-200 text-gray-600'}`}
                  >
                    {languages[lang].flag} {lang}
                  </button>
                ))}
                <button className="px-3 py-1.5 rounded-full text-xs border border-gray-200 text-gray-600">More...</button>
              </div>

              <div className="pt-4 px-3 space-y-3">
                <Link
                  to="/user/login"
                  className="block w-full text-center bg-green-700 text-white px-6 py-3 rounded-lg text-base font-semibold"
                  onClick={() => setIsOpen(false)}
                >
                  <TranslatedText>Join as User</TranslatedText>
                </Link>
                <Link
                  to="/vendor/login"
                  className="block w-full text-center border-2 border-green-700 text-green-700 px-6 py-3 rounded-lg text-base font-semibold"
                  onClick={() => setIsOpen(false)}
                >
                  <TranslatedText>Join as Vendor</TranslatedText>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;

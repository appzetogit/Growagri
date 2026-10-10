import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
// eslint-disable-next-line no-unused-vars
import { motion } from "framer-motion";
import { ensureIds, loadCatalog } from "./utils";
import HomePage from "./pages/HomePage";
import CategoriesPage from "./pages/CategoriesPage";
import ServicesPage from "./pages/ServicesPage";
import BrandsPage from "./pages/BrandsPage";


import { cityService } from "../../services/cityService";

const UserCategories = () => {
  const [catalog, setCatalog] = useState(() => ensureIds(loadCatalog()));
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState('');

  useEffect(() => {
    const handler = () => setCatalog(ensureIds(loadCatalog()));
    window.addEventListener("adminUserAppCatalogUpdated", handler);
    return () => window.removeEventListener("adminUserAppCatalogUpdated", handler);
  }, []);

  useEffect(() => {
    // Clear any previously persisted adminSelectedCity so this page always opens on Default (All India)
    try {
      localStorage.removeItem('adminSelectedCity');
    } catch (_e) {
      void _e;
    }
  }, []);

  // Fetch cities once for the parent container
  useEffect(() => {
    const fetchCities = async () => {
      try {
        if (cities.length === 0) {
          const response = await cityService.getAll();
          if (response.success) {
            const currentCities = (response.cities || []).filter(city => city.isActive);
            setCities(currentCities);
          }
        }
      } catch (error) {
        console.error('Failed to fetch cities:', error);
      }
    };
    fetchCities();
  }, [cities.length]);

  // Get admin role to control UI visibility
  const isAdminSuper = (() => {
    try {
      const storedData = sessionStorage.getItem('adminData') || localStorage.getItem('adminData');
      const stored = JSON.parse(storedData || '{}');
      return (stored.role || 'admin') === 'super_admin';
    } catch (_e) {
      void _e;
      return false;
    }
  })();

  return (
    <div className="space-y-4">
      {/* Global City Filter Header - Visible only to Super Admin */}
      {isAdminSuper && (
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-4 rounded-xl shadow-lg flex items-center justify-between text-white border border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-white">Parameters</h2>
            <p className="text-sm text-slate-300">Filter all catalog content by city</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-200">Selected City:</label>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="px-4 py-2 bg-slate-700 text-white border border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 min-w-[200px]"
            >
              <option value="" className="font-bold text-yellow-300">Default (All India) - Fallback</option>
              {cities.map(city => {
                const cityId = city._id || city.id;
                return <option key={cityId} value={cityId}>{city.name}</option>
              })}
            </select>
          </div>
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <Routes>
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={<HomePage catalog={catalog} setCatalog={setCatalog} selectedCity={selectedCity} />} />
          <Route path="categories" element={<CategoriesPage catalog={catalog} setCatalog={setCatalog} selectedCity={selectedCity} />} />
          <Route path="sections" element={<ServicesPage catalog={catalog} setCatalog={setCatalog} selectedCity={selectedCity} />} />
          <Route path="brands" element={<BrandsPage catalog={catalog} setCatalog={setCatalog} selectedCity={selectedCity} />} />

          <Route path="*" element={<Navigate to="home" replace />} />
        </Routes>
      </motion.div>
    </div>
  );
};

export default UserCategories;



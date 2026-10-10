import React, { createContext, useState, useContext, useEffect } from 'react';
import api, { apiCache } from '../services/api';

const CityContext = createContext();

export const useCity = () => useContext(CityContext);

export const CityProvider = ({ children }) => {
  const [currentCity, setCurrentCity] = useState(() => {
    try {
      const saved = localStorage.getItem('cached_current_city');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [cities, setCities] = useState(() => {
    try {
      const saved = localStorage.getItem('cached_cities');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(() => {
    const hasCity = !!localStorage.getItem('cached_current_city');
    const hasCities = !!localStorage.getItem('cached_cities');
    return !hasCity && !hasCities;
  });

  // Load cities and restore selection on mount
  useEffect(() => {
    const initCity = async () => {
      try {
        // Fetch active cities from public API
        const response = await api.get('/public/cities');

        if (response.data.success && response.data.cities.length > 0) {
          const fetchedCities = response.data.cities;
          setCities(fetchedCities);
          try {
            localStorage.setItem('cached_cities', JSON.stringify(fetchedCities));
          } catch {}

          // Check if user has a saved city
          const savedCityId = localStorage.getItem('selectedCityId');
          let selected = null;

          if (savedCityId) {
            selected = fetchedCities.find(c => c._id === savedCityId || c.id === savedCityId);
          }

          // If no active saved city, fallback to default or first active
          if (!selected) {
            selected = fetchedCities.find(c => c.isDefault) || fetchedCities[0];
          }

          setCurrentCity(selected);
          if (selected) {
            localStorage.setItem('selectedCityId', selected._id || selected.id);
            try {
              localStorage.setItem('cached_current_city', JSON.stringify(selected));
            } catch {}
          }
        }
      } catch (error) {
        console.error('Failed to load cities:', error);
      } finally {
        setLoading(false);
      }
    };

    initCity();
  }, []);

  const selectCity = (city) => {
    setCurrentCity(city);
    // Invalidate public catalog cache so categories reload for new city
    if (apiCache && typeof apiCache.invalidatePrefix === 'function') {
      apiCache.invalidatePrefix('public:');
    }
    if (city) {
      localStorage.setItem('selectedCityId', city._id || city.id);
      try {
        localStorage.setItem('cached_current_city', JSON.stringify(city));
      } catch {}
    } else {
      localStorage.removeItem('selectedCityId');
      localStorage.removeItem('cached_current_city');
    }
  };

  const value = {
    currentCity,
    cities,
    selectCity,
    loading
  };

  return (
    <CityContext.Provider value={value}>
      {children}
    </CityContext.Provider>
  );
};

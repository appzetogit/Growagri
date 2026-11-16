import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCloud, FiCloudRain, FiSun } from 'react-icons/fi';
import { motion } from 'framer-motion';
import weatherService from '../../../services/weatherService';
import { useLanguage } from '../../../../../context/LanguageContext';

const CACHE_KEY = 'cached_weather_report';
const COORDS_KEY = 'weather_coords';
const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };

// Fast location: accept a 30-min-old fix, never hang (8s timeout), fall back to last known coords
const getCoords = () => new Promise((resolve) => {
    const last = read(COORDS_KEY);
    if (!("geolocation" in navigator)) return resolve(last);
    navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
            const c = { lat: coords.latitude, lon: coords.longitude };
            write(COORDS_KEY, c);
            resolve(c);
        },
        () => resolve(last),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 30 * 60 * 1000 }
    );
});

// One fetch shared by WeatherWidget + WeatherBanner + WeatherReport (module-level promise)
let weatherPromise = null;
export const fetchWeather = () => {
    if (!weatherPromise) {
        weatherPromise = getCoords().then(async (c) => {
            if (!c) return { data: null, error: "Location access denied. Please allow location to see weather for your fields." };
            try {
                const res = await weatherService.getWeather(c.lat, c.lon);
                if (!res.success) return { data: null, error: res.message || "Failed to fetch weather data" };
                write(CACHE_KEY, res.data);
                return { data: res.data, error: null };
            } catch (err) {
                console.error("Weather error:", err);
                return { data: null, error: err.response?.data?.error || err.response?.data?.message || "Failed to fetch weather data" };
            }
        }).then((r) => {
            if (!r.data) weatherPromise = null; // retry on next mount
            return r;
        });
    }
    return weatherPromise;
};

// Stale-while-revalidate: cached weather renders instantly, fresh data replaces it
export function useWeather() {
    const [weather, setWeather] = useState(() => read(CACHE_KEY));
    const [loading, setLoading] = useState(() => !read(CACHE_KEY));
    const [error, setError] = useState(null);
    useEffect(() => {
        let alive = true;
        fetchWeather().then(({ data, error }) => {
            if (!alive) return;
            if (data) setWeather(data);
            setError(error);
            setLoading(false);
        });
        return () => { alive = false; };
    }, []);
    return { weather, loading, error };
}

export default function WeatherWidget() {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const { weather, loading } = useWeather();

    const getWeatherIcon = (description) => {
        const d = description?.toLowerCase() || '';
        if (d.includes('rain')) return <FiCloudRain className="w-7 h-7 sm:w-8 sm:h-8 text-blue-500 drop-shadow-xs" />;
        if (d.includes('cloud')) return <FiCloud className="w-7 h-7 sm:w-8 sm:h-8 text-sky-500 drop-shadow-xs" />;
        if (d.includes('sun') || d.includes('clear')) return <FiSun className="w-7 h-7 sm:w-8 sm:h-8 text-amber-500 drop-shadow-xs" />;
        return <FiCloud className="w-7 h-7 sm:w-8 sm:h-8 text-sky-500 drop-shadow-xs" />;
    };

    const displayTemp = weather ? `${Math.round(weather.current.temp)}°C` : (loading ? "..." : "--");
    const displayDesc = weather ? weather.current.description : (loading ? "Loading..." : "Sunny");
    const iconToRender = weather ? getWeatherIcon(weather.current.description) : <FiSun className="w-7 h-7 sm:w-8 sm:h-8 text-amber-500 drop-shadow-xs" />;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => navigate('/user/weather')}
            className="relative bg-white border border-slate-100/90 rounded-[20px] sm:rounded-[22px] px-1.5 py-3 sm:px-2.5 sm:py-3.5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-md transition-all active:scale-95 group flex flex-col items-center justify-between text-center cursor-pointer min-h-[114px] sm:min-h-[128px]"
        >
            {/* Circular Weather Badge Matching Reference */}
            <div className="relative w-[76px] h-[76px] min-[390px]:w-[88px] min-[390px]:h-[88px] sm:w-24 sm:h-24 rounded-full p-1 flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-amber-50 via-sky-50 to-blue-50 border border-sky-100 shadow-xs transition-transform duration-300 group-hover:scale-105 overflow-hidden">
                <div className="flex items-center justify-center z-10">
                    {iconToRender}
                </div>
                
                {/* Temperature Pill Badge */}
                {(!loading && weather) && (
                    <div className="absolute top-0.5 right-0.5 bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.2 rounded-full shadow-xs border border-white z-20">
                        {displayTemp}
                    </div>
                )}
            </div>

            {/* Title (Single Line, No Subtitle) */}
            <div className="w-full mt-2 sm:mt-2.5 flex-1 flex flex-col items-center justify-center">
                <p className="text-[10.5px] min-[360px]:text-[11.5px] min-[390px]:text-[12px] sm:text-[13px] font-bold text-slate-800 leading-tight tracking-tight text-center whitespace-nowrap overflow-hidden text-ellipsis px-0.5">
                    {t('Weather')}
                </p>
            </div>
        </motion.div>
    );
}

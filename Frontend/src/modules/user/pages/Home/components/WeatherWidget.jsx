import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCloud, FiCloudRain, FiSun } from 'react-icons/fi';
import { motion } from 'framer-motion';
import weatherService from '../../../services/weatherService';
import { useLanguage } from '../../../../../context/LanguageContext';

// One fetch shared by WeatherWidget + WeatherBanner (module-level promise)
let weatherPromise = null;
const fetchWeather = () => {
    if (!weatherPromise) {
        weatherPromise = new Promise((resolve) => {
            if (!("geolocation" in navigator)) return resolve(null);
            navigator.geolocation.getCurrentPosition(
                async ({ coords }) => {
                    try {
                        const res = await weatherService.getWeather(coords.latitude, coords.longitude);
                        resolve(res.success ? res.data : null);
                    } catch (err) {
                        console.error("Weather error:", err);
                        resolve(null);
                    }
                },
                () => resolve(null)
            );
        }).then((data) => {
            if (!data) weatherPromise = null; // retry on next mount
            return data;
        });
    }
    return weatherPromise;
};

export function useWeather() {
    const [weather, setWeather] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        let alive = true;
        fetchWeather().then((data) => {
            if (!alive) return;
            setWeather(data);
            setLoading(false);
        });
        return () => { alive = false; };
    }, []);
    return { weather, loading };
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
            <div className="relative w-16 h-16 min-[390px]:w-[72px] min-[390px]:h-[72px] sm:w-20 sm:h-20 rounded-full p-1 flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-amber-50 via-sky-50 to-blue-50 border border-sky-100 shadow-xs transition-transform duration-300 group-hover:scale-105 overflow-hidden">
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

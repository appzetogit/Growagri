import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiDroplet, FiUmbrella, FiWind, FiSun, FiCloud, FiCloudRain, FiMapPin } from 'react-icons/fi';
import { useLanguage } from '../../../../../context/LanguageContext';
import { useWeather } from './WeatherWidget';

const pickIcon = (desc = '') => {
  const d = desc.toLowerCase();
  if (d.includes('rain') || d.includes('storm') || d.includes('shower')) return FiCloudRain;
  if (d.includes('cloud') || d.includes('overcast') || d.includes('fog') || d.includes('mist')) return FiCloud;
  return FiSun;
};

// Static (non-promo) weather card shown first in the hero carousel. Same size as PromoCard.
export default function WeatherBanner() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { weather, loading } = useWeather();
  const c = weather?.current;
  const Icon = pickIcon(c?.description);
  const dash = loading ? '…' : '--';

  const stats = [
    { icon: FiDroplet, value: c ? `${Math.round(c.humidity)}%` : dash, label: t('Humidity') },
    { icon: FiUmbrella, value: c ? `${Math.round(c.precipitation_prob)}%` : dash, label: t('Rain %') },
    { icon: FiWind, value: c ? `${c.wind_speed} km/h` : dash, label: t('Wind') },
  ];

  return (
    <div
      onClick={() => navigate('/user/weather')}
      className="relative rounded-2xl overflow-hidden w-[86vw] sm:w-auto min-w-[340px] sm:min-w-[390px] md:min-w-[460px] max-w-[520px] aspect-[2/1] cursor-pointer transition-all duration-300 active:scale-95 text-white px-4 py-3 flex flex-col justify-between"
      style={{ background: 'linear-gradient(135deg, #1e6fd9 0%, #2563eb 55%, #1d4ed8 100%)' }}
    >
      {/* Location + icon */}
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[14px] font-bold leading-tight truncate flex items-center gap-1">
            <FiMapPin className="w-3.5 h-3.5 flex-shrink-0" />
            {c?.city || (loading ? t('Loading...') : t('Weather'))}
          </p>
          <p className="text-[10px] text-white/75 mt-0.5">
            {c ? t('Updated just now') : !loading ? t('Enable location for weather') : ''}
          </p>
        </div>
        {c?.icon
          ? <img src={c.icon} alt="" className="w-9 h-9 flex-shrink-0" />
          : <Icon className="w-8 h-8 text-amber-300 flex-shrink-0" />}
      </div>

      {/* Temp + description */}
      <div className="flex items-center gap-3">
        <span className="text-[34px] sm:text-[38px] font-black leading-none">
          {c ? `${Math.round(c.temp)}°` : dash}
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-bold leading-tight truncate capitalize">{c ? t(c.description) : ''}</p>
          {c?.feels_like != null && (
            <p className="text-[11px] text-white/80">{t('Feels like')} {Math.round(c.feels_like)}°</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 text-center">
        {stats.map(({ icon: S, value, label }) => (
          <div key={label} className="flex flex-col items-center">
            <S className="w-3.5 h-3.5 text-white/80" />
            <span className="text-[13px] font-bold leading-tight mt-0.5">{value}</span>
            <span className="text-[9.5px] text-white/75 leading-tight">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

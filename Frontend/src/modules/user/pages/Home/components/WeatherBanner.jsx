import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiDroplet, FiCloudRain, FiWind, FiSun, FiCloud, FiMapPin, FiChevronRight } from 'react-icons/fi';
import { useLanguage } from '../../../../../context/LanguageContext';
import { useWeather } from './WeatherWidget';

const pickIcon = (desc = '') => {
  const d = desc.toLowerCase();
  if (d.includes('rain') || d.includes('storm') || d.includes('shower')) return FiCloudRain;
  if (d.includes('cloud') || d.includes('overcast') || d.includes('fog') || d.includes('mist')) return FiCloud;
  return FiSun;
};

// Home weather card (shown below categories): sky-to-field look, stats row, 7-day forecast CTA.
export default function WeatherBanner({ className = '' }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { weather, loading } = useWeather();
  const c = weather?.current;
  const Icon = pickIcon(c?.description);
  const dash = loading ? '…' : '--';

  const stats = [
    { icon: FiDroplet, value: c ? `${Math.round(c.humidity)}%` : dash, label: t('Humidity') },
    { icon: FiCloudRain, value: c ? `${Math.round(c.precipitation_prob)}%` : dash, label: t('Rain Chance') },
    { icon: FiWind, value: c ? `${c.wind_speed} km/h` : dash, label: t('Wind') },
  ];

  return (
    <div
      onClick={() => navigate('/user/weather')}
      className={`relative rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform border border-sky-100 shadow-[0_2px_12px_rgba(15,42,92,0.08)] text-[#0f2a5c] ${className}`}
      style={{ background: 'linear-gradient(180deg, #e0f2fe 0%, #f0f9ff 45%, #dcfce7 80%, #bbf7d0 100%)' }}
    >
      {/* Top: location, temp, icon */}
      <div className="flex items-start justify-between px-4 pt-3">
        <div className="min-w-0">
          <p className="text-[14px] font-bold leading-tight truncate flex items-center gap-1">
            <FiMapPin className="w-4 h-4 flex-shrink-0" />
            {c?.city || (loading ? t('Loading...') : t('Weather'))}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5 pl-5">
            {c ? t('Updated just now') : !loading ? t('Enable location for weather') : ''}
          </p>

          <div className="flex items-center gap-3 mt-2">
            <span className="flex items-start text-[38px] font-black leading-none">
              {c ? Math.round(c.temp) : dash}{c && <span className="text-[16px] font-bold mt-1 ml-0.5">°C</span>}
            </span>
            {c && (
              <div className="min-w-0 border-l border-slate-300 pl-3">
                <p className="text-[15px] font-bold leading-tight truncate capitalize">{t(c.description)}</p>
                {c.feels_like != null && (
                  <p className="text-[11px] text-slate-500">{t('Feels like')} {Math.round(c.feels_like)}°C</p>
                )}
              </div>
            )}
          </div>
        </div>
        {c?.icon
          ? <img src={c.icon} alt="" className="w-16 h-16 flex-shrink-0" />
          : <Icon className="w-14 h-14 text-amber-400 flex-shrink-0" />}
      </div>

      {/* Bottom: stats + forecast CTA */}
      <div className="flex items-center gap-2 mx-2 mb-2 mt-3 px-2 py-2 rounded-xl bg-white/70 backdrop-blur-sm">
        <div className="grid grid-cols-3 flex-1 divide-x divide-slate-200">
          {stats.map(({ icon: S, value, label }) => (
            <div key={label} className="flex items-center gap-1.5 px-1.5 min-w-0">
              <S className="w-4 h-4 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[12px] font-bold leading-tight whitespace-nowrap">{value}</p>
                <p className="text-[9.5px] text-slate-500 leading-tight truncate">{label}</p>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="flex-shrink-0 flex items-center gap-0.5 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10.5px] font-bold leading-tight text-[#0f2a5c]"
        >
          <span className="text-center">{t('7-Day')}<br />{t('Forecast')}</span>
          <FiChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

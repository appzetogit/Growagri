const axios = require('axios');

// ponytail: in-memory cache per ~1km grid for 10 min; move to Redis if running multiple instances
const cache = new Map();
const TTL = 10 * 60 * 1000;

/**
 * Get Weather Data for a specific location using Google Weather API
 * GET /api/weather?lat=...&lon=...
 */
const getWeatherData = async (req, res) => {
    try {
        const { lat, lon } = req.query;
        // Try every configured key; first one that works wins (a replaced/restricted key won't kill weather)
        const keys = [...new Set([process.env.WEATHER_API_KEY, process.env.GOOGLE_MAPS_API_KEY].filter(Boolean))];

        if (!keys.length) {
            return res.status(500).json({ success: false, message: 'Google Maps / Weather API key not configured' });
        }

        if (!lat || !lon) {
            return res.status(400).json({ success: false, message: 'Latitude and Longitude are required' });
        }

        const cacheKey = `${Number(lat).toFixed(2)},${Number(lon).toFixed(2)}`;
        const hit = cache.get(cacheKey);
        if (hit && Date.now() - hit.at < TTL) return res.status(200).json(hit.body);

        // 1. Current Weather + Forecast (required) and City Name (optional), with the first working key
        let currentRes, forecastRes, geocodeRes, lastErr;
        for (const apiKey of keys) {
            const q = `key=${apiKey}&location.latitude=${lat}&location.longitude=${lon}&unitsSystem=METRIC`;
            const opts = { timeout: 8000 };
            const [c, f, g] = await Promise.allSettled([
                axios.get(`https://weather.googleapis.com/v1/currentConditions:lookup?${q}`, opts),
                axios.get(`https://weather.googleapis.com/v1/forecast/days:lookup?${q}&days=10&pageSize=10`, opts),
                axios.get(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${apiKey}`, opts)
            ]);
            if (c.status === 'fulfilled' && f.status === 'fulfilled') {
                currentRes = c.value; forecastRes = f.value; geocodeRes = g.value;
                break;
            }
            lastErr = c.reason || f.reason;
            console.error(`Weather key ${apiKey.slice(0, 8)}... failed:`, lastErr?.response?.data?.error?.message || lastErr?.message);
        }
        if (!currentRes) throw lastErr;

        const current = currentRes.data;
        const forecast = forecastRes.data;

        // Extract exact city/locality name from Geocoding results
        let cityName = 'Current Location';
        if (geocodeRes?.data?.results?.length > 0) {
            const addressComponents = geocodeRes.data.results[0].address_components;
            const cityComp = addressComponents.find(c => c.types.includes('locality') || c.types.includes('administrative_area_level_2'));
            if (cityComp) cityName = cityComp.long_name;
        }

        // 2. Add Agriculture Insights based on weather
        const mainWeatherType = current.weatherCondition?.type || '';
        const temp = current.temperature?.degrees || 0;
        const humidity = current.relativeHumidity || 0;
        const windSpeed = current.wind?.speed?.value || 0;

        let agriAlert = "Ideal weather for farming activities.";

        if (mainWeatherType.includes('RAIN') || mainWeatherType.includes('STORM')) {
            agriAlert = "Rain detected. Avoid pesticide spraying and ensure proper drainage in fields.";
        } else if (temp > 35) {
            agriAlert = "High temperature alert. Increase irrigation frequency to prevent crop heat stress.";
        } else if (windSpeed > 20) {
            agriAlert = "High wind speed. Avoid drone spraying or chemical applications.";
        } else if (humidity > 80 && temp > 20) {
            agriAlert = "High humidity detected. Monitor crops for potential fungal infections or pests.";
        }

        // Map Google Icons
        const getIconUrl = (baseUri) => baseUri ? `${baseUri}.svg` : '';

        const body = {
            success: true,
            data: {
                current: {
                    temp: temp,
                    feels_like: current.feelsLikeTemperature?.degrees,
                    humidity: humidity,
                    pressure: current.airPressure?.meanSeaLevelMillibars,
                    wind_speed: windSpeed.toFixed(1),
                    description: current.weatherCondition?.description?.text || 'No description',
                    icon: getIconUrl(current.weatherCondition?.iconBaseUri),
                    city: cityName,
                    
                    // Extra Details for Agri Support
                    uv_index: current.uvIndex,
                    precipitation_prob: current.precipitation?.probability?.percent || 0,
                    thunderstorm_prob: current.thunderstormProbability || 0,
                    cloud_cover: current.cloudCover,
                    visibility: current.visibility?.distance,
                    sunrise: current.sunEvents?.sunriseTime || forecast.forecastDays?.[0]?.sunEvents?.sunriseTime,
                    sunset: current.sunEvents?.sunsetTime || forecast.forecastDays?.[0]?.sunEvents?.sunsetTime
                },
                forecast: (forecast.forecastDays || []).map(day => ({
                    date: `${day.displayDate.year}-${String(day.displayDate.month).padStart(2, '0')}-${String(day.displayDate.day).padStart(2, '0')}`,
                    temp: day.maxTemperature?.degrees,
                    min_temp: day.minTemperature?.degrees,
                    description: day.daytimeForecast?.weatherCondition?.description?.text || 'N/A',
                    icon: getIconUrl(day.daytimeForecast?.weatherCondition?.iconBaseUri),
                    humidity: day.daytimeForecast?.relativeHumidity,
                    
                    // Extra Forecast Details
                    uv_index: day.daytimeForecast?.uvIndex,
                    precipitation_prob: day.daytimeForecast?.precipitation?.probability?.percent || 0,
                    thunderstorm_prob: day.daytimeForecast?.thunderstormProbability || 0,
                    cloud_cover: day.daytimeForecast?.cloudCover,
                    visibility: day.daytimeForecast?.visibility?.distance,
                    sunrise: day.sunEvents?.sunriseTime,
                    sunset: day.sunEvents?.sunsetTime
                })),
                agriAlert,
                provider: 'google'
            }
        };
        cache.set(cacheKey, { at: Date.now(), body });
        if (cache.size > 5000) cache.clear();
        res.status(200).json(body);

    } catch (error) {
        console.error('Google Weather API Error:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch weather data from Google',
            error: error.response?.data?.error?.message || error.message
        });
    }
};

module.exports = {
    getWeatherData
};

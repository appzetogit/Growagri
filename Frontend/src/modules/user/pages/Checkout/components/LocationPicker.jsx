import React, { useState, useEffect, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Autocomplete } from '@react-google-maps/api';
import { FiCrosshair, FiSearch } from 'react-icons/fi';

export const GOOGLE_MAPS_LIBRARIES = ['places', 'geometry'];

const defaultCenter = {
  lat: 28.6139,
  lng: 77.2090
};

const samePos = (a, b) => a && b && Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6;

/**
 * Uber-style picker: the pin stays fixed in the middle, the user drags the map underneath it,
 * and whatever is under the pin when the map stops moving becomes the selected location.
 */
const LocationPicker = ({ onLocationSelect, initialPosition = null }) => {
  const [map, setMap] = useState(null);
  const [startCenter] = useState(initialPosition || defaultCenter); // only the first render's center; the map is uncontrolled after that
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [autocomplete, setAutocomplete] = useState(null);

  const lastReported = useRef(null); // last position we sent to the parent
  const skipNextIdle = useRef(false); // set when we already know the address of the new center
  const onSelectRef = useRef(onLocationSelect);
  useEffect(() => { onSelectRef.current = onLocationSelect; }, [onLocationSelect]);

  const report = (location) => {
    lastReported.current = { lat: location.lat, lng: location.lng };
    onSelectRef.current?.(location);
  };

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES
  });

  // Reverse geocode the point under the pin
  const reverseGeocode = (position) => {
    if (!window.google) return;
    setLoading(true);
    new window.google.maps.Geocoder().geocode({ location: position }, (results, status) => {
      setLoading(false);
      if (status === 'OK' && results[0]) {
        report({
          lat: position.lat,
          lng: position.lng,
          address: results[0].formatted_address,
          components: results[0].address_components
        });
      }
    });
  };

  // Move the map so `pos` sits under the pin
  const moveTo = (pos, zoom, addressKnown = false) => {
    if (!map) return;
    const c = map.getCenter();
    // panTo to the current center fires no 'idle', so don't leave a skip flag that would swallow the next drag
    skipNextIdle.current = addressKnown && !(c && samePos({ lat: c.lat(), lng: c.lng() }, pos));
    map.panTo(pos);
    if (zoom) map.setZoom(zoom);
  };

  // Map stopped moving -> the location under the pin is the selection
  const handleIdle = () => {
    setDragging(false);
    if (!map) return;
    const c = map.getCenter();
    const pos = { lat: c.lat(), lng: c.lng() };
    if (skipNextIdle.current) {
      skipNextIdle.current = false;
      return;
    }
    if (samePos(pos, lastReported.current)) return;
    reverseGeocode(pos);
  };

  const handlePlaceChanged = () => {
    const place = autocomplete?.getPlace();
    if (!place?.geometry?.location) return;
    const pos = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
    moveTo(pos, 17, true);
    report({ ...pos, address: place.formatted_address || '', components: place.address_components || [] });
  };

  // External selection (e.g. the parent's own search box): bring that spot under the pin.
  // Ignore our own reports echoing back through the parent, so the user's zoom isn't reset.
  useEffect(() => {
    if (!map || !initialPosition || samePos(initialPosition, lastReported.current)) return;
    lastReported.current = { lat: initialPosition.lat, lng: initialPosition.lng };
    moveTo(initialPosition, 16, true);
  }, [initialPosition, map]);

  const locateMe = (silent) => {
    if (!navigator.geolocation) {
      if (!silent) alert('Geolocation is not supported by your browser.');
      return;
    }
    if (!silent) setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLoading(false);
        moveTo({ lat: p.coords.latitude, lng: p.coords.longitude }, 17); // idle will geocode
      },
      (error) => {
        setLoading(false);
        if (silent) return;
        let errorMessage = 'Unable to get your current location.';
        if (error.code === 1) errorMessage = 'Location permission denied. Please enable location services.';
        else if (error.code === 2) errorMessage = 'Location unavailable. Please check your GPS.';
        else if (error.code === 3) errorMessage = 'Location request timed out.';
        alert(`${errorMessage} Please move the map to your location.`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // No starting position -> try the user's current location once the map is ready
  useEffect(() => {
    if (map && !initialPosition) locateMe(true);
  }, [map]);

  if (loadError) {
    return <div className="h-64 bg-gray-200 flex items-center justify-center">
      <p className="text-red-600">Error loading Google Maps</p>
    </div>;
  }

  if (!isLoaded) {
    return <div className="h-64 bg-gray-200 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
    </div>;
  }

  return (
    <div className="w-full relative shadow-sm rounded-3xl overflow-hidden border border-slate-200">
      <style>{`
        .pac-container {
          z-index: 100000 !important;
        }
      `}</style>
      <div className="relative h-64 bg-slate-100">
        {/* Search Bar Overlay */}
        <div className="absolute top-4 left-4 right-4 z-10">
          <Autocomplete onLoad={setAutocomplete} onPlaceChanged={handlePlaceChanged}>
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search location..."
                className="w-full bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-xl py-2 pl-9 pr-3 font-semibold outline-none text-xs text-slate-800 placeholder:text-slate-400 shadow-md focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
              />
            </div>
          </Autocomplete>
        </div>

        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={startCenter}
          zoom={15}
          onLoad={setMap}
          onDragStart={() => setDragging(true)}
          onIdle={handleIdle}
          onClick={(e) => moveTo({ lat: e.latLng.lat(), lng: e.latLng.lng() })}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            gestureHandling: 'greedy',
            zoomControl: false,
            clickableIcons: false,
            disableDefaultUI: true
          }}
        />

        {/* Fixed center pin: the tip marks the exact map center. Pointer events pass through to the map. */}
        <div className="absolute left-1/2 top-1/2 z-10 pointer-events-none" style={{ transform: 'translate(-50%, -100%)' }}>
          <svg
            width="36"
            height="46"
            viewBox="0 0 24 30"
            className="drop-shadow-lg transition-transform duration-150"
            style={{ transform: dragging ? 'translateY(-8px)' : 'none' }}
          >
            <path d="M12 0C5.4 0 0 5.2 0 11.7 0 20.3 12 30 12 30s12-9.7 12-18.3C24 5.2 18.6 0 12 0z" fill="#EA4335" />
            <circle cx="12" cy="11.5" r="4.2" fill="#fff" />
          </svg>
        </div>
        {/* Ground shadow so the lifted pin reads as "picking up" while dragging */}
        <div
          className="absolute left-1/2 top-1/2 z-[5] pointer-events-none rounded-full bg-black/30 transition-all duration-150"
          style={{ width: dragging ? 10 : 6, height: dragging ? 4 : 3, transform: 'translate(-50%, -50%)' }}
        />

        {/* Pin Instruction Overlay */}
        <div className="absolute bottom-4 left-4 bg-slate-900/90 text-white px-3 py-1.5 rounded-xl text-[9px] uppercase font-black tracking-widest z-10 shadow-lg backdrop-blur-sm">
          {dragging ? 'Release to set location' : loading ? 'Fetching address...' : 'Move map to adjust pin'}
        </div>

        {/* Locate Me Button */}
        <button
          type="button"
          onClick={() => locateMe(false)}
          className="absolute bottom-4 right-4 p-3.5 bg-white rounded-xl shadow-lg flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all z-10 border border-slate-100 text-teal-600"
        >
          <FiCrosshair className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default LocationPicker;

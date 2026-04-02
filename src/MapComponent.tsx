import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import * as turf from '@turf/turf';
import L from 'leaflet';
import { ChevronDown, Map as MapIcon } from 'lucide-react';

const COLORS = [
  '#FFB3BA', '#FFDFBA', '#FFFFBA', '#B5EAD7', '#C7CEEA', 
  '#e2f0cb', '#ff9cece', '#ffdac1', '#f3b0c3', '#a2e1db', 
  '#55cbcd', '#a2d5f2', '#ffc4a3', '#fcdab7', '#c8e7ff',
  '#a2bce0', '#e3a8f4', '#f1e0d6', '#bfd8d2', '#dfd3c3'
];

interface FeatureProps {
  name: string;
  adcode: string;
}

interface FeatureContext {
  color: string;
  area: number;
}

// Component to handle map centering and bounds
const MapBoundsController = ({ bounds }: { bounds: L.LatLngBounds | null }) => {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [20, 20], animate: true, duration: 1 });
    }
  }, [bounds, map]);
  return null;
};

// Component to handle the main map layer
const ChinaMapLayer = ({ geoData, selectedProvince, onProvinceSelect }: any) => {
  const geoJsonRef = useRef<L.GeoJSON>(null);
  
  // Pre-calculate colors and areas to avoid re-rendering issues
  const featureContext = useMemo(() => {
    const ctx: Record<string, FeatureContext> = {};
    if (geoData?.features) {
      geoData.features.forEach((feature: any) => {
        const name = feature.properties?.name || 'Unknown';
        const adcode = feature.properties?.adcode || name;
        
        // Compute Area (sq km)
        const areaSqMeters = turf.area(feature as turf.Feature<turf.Polygon | turf.MultiPolygon>);
        const areaSqKm = Math.round(areaSqMeters / 1000000);
        
        // Random beautiful color
        const color = COLORS[Math.floor(Math.random() * COLORS.length)];
        
        ctx[name] = { color, area: areaSqKm };
      });
    }
    return ctx;
  }, [geoData]);

  const styleFeature = (feature: any) => {
    const name = feature?.properties?.name;
    const isSelected = selectedProvince === name;
    const ctx = featureContext[name];
    
    return {
      fillColor: ctx?.color || '#cccccc',
      weight: isSelected ? 3 : 1,
      opacity: 1,
      color: isSelected ? '#333333' : '#666666', // outline color
      fillOpacity: isSelected ? 0.9 : 0.6,
    };
  };

  const onEachFeature = (feature: any, layer: L.Layer) => {
    const name = feature?.properties?.name || 'Unknown';
    const ctx = featureContext[name];
    
    // Add tooltip containing province name and area
    layer.bindTooltip(
      `<div style="text-align:center; font-family:Inter,sans-serif;">
        <div style="font-weight:bold; font-size:14px; text-shadow: 1px 1px 2px white; color:#333;">${name}</div>
        <div style="font-size:12px; color:#555;">${ctx?.area?.toLocaleString() || 0} km²</div>
      </div>`,
      { permanent: true, direction: 'center', className: 'province-label bg-transparent border-0 shadow-none' }
    );

    layer.on({
      click: (e) => {
        onProvinceSelect(name, (layer as any).getBounds());
      },
      mouseover: (e) => {
        const target = e.target;
        target.setStyle({ fillOpacity: 0.8, weight: 2 });
        target.bringToFront();
      },
      mouseout: (e) => {
        if (geoJsonRef.current) {
          geoJsonRef.current.resetStyle(e.target);
        }
      }
    });
  };

  return (
    <GeoJSON 
      ref={geoJsonRef}
      key="map-layer"
      data={geoData} 
      style={styleFeature}
      onEachFeature={onEachFeature}
    />
  );
};

export default function MapComponent() {
  const [geoData, setGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProvince, setSelectedProvince] = useState<string>('');
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);
  const [chinaBounds, setChinaBounds] = useState<L.LatLngBounds | null>(null);

  useEffect(() => {
    fetch('/api/china_gis.json')
      .then(res => res.json())
      .then(data => {
        setGeoData(data);
        
        // Calculate bounds for entire country
        const layer = L.geoJSON(data);
        const fb = layer.getBounds();
        setChinaBounds(fb);
        setBounds(fb); // Default zoom to country
        
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch GIS data: ", err);
        setLoading(false);
      });
  }, []);

  const provinces = useMemo(() => {
    if (!geoData) return [];
    const list = geoData.features.map((f: any) => f.properties.name).filter(Boolean);
    list.sort();
    return list;
  }, [geoData]);

  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedProvince(val);
    
    if (!val) {
      // Zoom back to whole country
      if (chinaBounds) setBounds(chinaBounds);
    } else {
      // Find feature and zoom to it
      const feature = geoData.features.find((f: any) => f.properties.name === val);
      if (feature) {
        const layer = L.geoJSON(feature);
        setBounds(layer.getBounds());
      }
    }
  };

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-slate-50">
        <div className="text-xl text-slate-500 font-semibold flex items-center gap-2">
          <MapIcon className="animate-pulse" /> Loading Map Data...
        </div>
      </div>
    );
  }

  if (!geoData) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-slate-50 text-red-500">
        Error loading Map Data.
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-slate-50 flex flex-col p-4 font-sans">
      <header className="mb-4 flex flex-col md:flex-row items-center justify-between bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2 mb-4 md:mb-0">
          <MapIcon className="text-blue-500" /> 中国行政区划地图
        </h1>
        
        <div className="relative">
          <select 
            className="appearance-none bg-slate-100 border border-slate-200 text-slate-700 py-2 pl-4 pr-10 rounded-xl outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent font-medium transition-all"
            value={selectedProvince}
            onChange={handleProvinceChange}
            id="province-select"
          >
            <option value="">-- 全国 (All Provinces) --</option>
            {provinces.map((name: string) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
        </div>
      </header>
      
      <div className="flex-1 w-full rounded-2xl overflow-hidden shadow-xl border border-slate-200 bg-blue-50 relative">
        <MapContainer 
          className="w-full h-full z-0 font-sans"
          zoomControl={false}
          scrollWheelZoom={true}
          attributionControl={false}
          id="map-container"
        >
          <MapBoundsController bounds={bounds} />
          <ChinaMapLayer 
             geoData={geoData} 
             selectedProvince={selectedProvince} 
             onProvinceSelect={(name: string, bds: L.LatLngBounds) => {
               setSelectedProvince(name);
               setBounds(bds);
             }} 
          />
        </MapContainer>
      </div>
    </div>
  );
}

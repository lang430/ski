import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import * as turf from '@turf/turf';
import L from 'leaflet';
import { ChevronDown, Map as MapIcon } from 'lucide-react';

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F8B500', '#FF6F61', '#6B5B95', '#88B04B', '#F7CAC9',
  '#92A8D1', '#955251', '#B565A7', '#009B77', '#DD4124'
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

  useEffect(() =&gt; {
    fetch('http://106.12.10.129:10010/uploads/china_gis.json')
      .then(res =&gt; res.json())
      .then(data =&gt; {
        setGeoData(data);
        
        // Calculate bounds for entire country
        const layer = L.geoJSON(data);
        const fb = layer.getBounds();
        setChinaBounds(fb);
        setBounds(fb); // Default zoom to country
        
        setLoading(false);
      })
      .catch(err =&gt; {
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
    <div className="w-screen h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex flex-col p-6 font-sans overflow-hidden">
      <header className="mb-6 flex flex-col lg:flex-row items-center justify-between bg-white/80 backdrop-blur-xl px-8 py-5 rounded-3xl shadow-2xl border border-white/50">
        <div className="flex items-center gap-3 mb-4 lg:mb-0">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg">
            <MapIcon className="text-white" size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-800 via-blue-600 to-purple-600 bg-clip-text text-transparent">
              中国行政区划地图
            </h1>
            <p className="text-sm text-gray-500 mt-1">34个省级行政区可视化 · 点击省份查看详情</p>
          </div>
        </div>
        
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative">
            <select 
              className="appearance-none bg-gradient-to-r from-slate-50 to-white border-2 border-slate-200 text-slate-700 py-3 pl-5 pr-12 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 font-semibold transition-all cursor-pointer min-w-[200px] hover:shadow-lg"
              value={selectedProvince}
              onChange={handleProvinceChange}
              id="province-select"
            >
              <option value="">🌍 全国 (All Provinces)</option>
              {provinces.map((name: string) => (
                <option key={name} value={name}>📍 {name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none transition-transform group-hover:translate-y-0" size={20} />
          </div>
        </div>
      </header>
      
      <div className="flex-1 w-full rounded-3xl overflow-hidden shadow-2xl border border-white/50 bg-white/60 backdrop-blur-sm relative">
        <div className="absolute top-4 left-4 z-[1000] bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl shadow-lg border border-gray-100 text-sm text-gray-600 font-medium">
          💡 鼠标滚轮缩放 · 点击省份聚焦
        </div>
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
      
      <footer className="mt-4 text-center text-sm text-gray-500">
        <span className="bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm border border-white/50">
          共 {provinces.length} 个省级行政区
        </span>
      </footer>
    </div>
  );
}

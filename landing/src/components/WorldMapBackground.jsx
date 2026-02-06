import { motion } from 'framer-motion';
import { ComposableMap, Geographies, Geography, Marker, Line } from 'react-simple-maps';

// URL per il topojson del mondo
const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Coordinate reali dei data center
const markers = [
  { name: 'New York', coordinates: [-74.006, 40.7128] },
  { name: 'Los Angeles', coordinates: [-118.2437, 34.0522] },
  { name: 'London', coordinates: [-0.1276, 51.5074] },
  { name: 'Frankfurt', coordinates: [8.6821, 50.1109] },
  { name: 'Paris', coordinates: [2.3522, 48.8566] },
  { name: 'Milan', coordinates: [9.19, 45.4642] },
  { name: 'Singapore', coordinates: [103.8198, 1.3521] },
  { name: 'Tokyo', coordinates: [139.6917, 35.6895] },
  { name: 'Sydney', coordinates: [151.2093, -33.8688] },
  { name: 'Mumbai', coordinates: [72.8777, 19.076] },
  { name: 'Dubai', coordinates: [55.2708, 25.2048] },
  { name: 'São Paulo', coordinates: [-46.6333, -23.5505] },
];

// Connessioni casuali tra i data center
const connections = [
  { from: 0, to: 2 },   // NYC -> London
  { from: 0, to: 3 },   // NYC -> Frankfurt
  { from: 2, to: 3 },   // London -> Frankfurt
  { from: 2, to: 6 },   // London -> Singapore
  { from: 3, to: 4 },   // Frankfurt -> Paris
  { from: 3, to: 10 },  // Frankfurt -> Dubai
  { from: 4, to: 5 },   // Paris -> Milan
  { from: 6, to: 7 },   // Singapore -> Tokyo
  { from: 6, to: 8 },   // Singapore -> Sydney
  { from: 6, to: 9 },   // Singapore -> Mumbai
  { from: 7, to: 8 },   // Tokyo -> Sydney
  { from: 9, to: 10 },  // Mumbai -> Dubai
  { from: 10, to: 5 },  // Dubai -> Milan
  { from: 0, to: 1 },   // NYC -> LA
  { from: 1, to: 7 },   // LA -> Tokyo
  { from: 1, to: 6 },   // LA -> Singapore
  { from: 0, to: 11 },  // NYC -> São Paulo
  { from: 11, to: 5 },  // São Paulo -> Milan
];

const WorldMapBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Base */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50" />
      
      {/* Mappa Reale */}
      <div className="absolute inset-0 opacity-50">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 140,
            center: [10, 30]
          }}
          style={{
            width: '100%',
            height: '100%',
          }}
        >
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#cbd5e1"
                  stroke="#94a3b8"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: 'none' },
                    hover: { outline: 'none' },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>

          {/* Linee di connessione */}
          {connections.map((conn, i) => (
            <Line
              key={`line-${i}`}
              from={markers[conn.from].coordinates}
              to={markers[conn.to].coordinates}
              stroke="#60a5fa"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeDasharray="4 4"
            />
          ))}

          {/* Marker Data Centers */}
          {markers.map((marker, i) => (
            <Marker key={marker.name} coordinates={marker.coordinates}>
              <g>
                {/* Glow animato */}
                <motion.circle
                  r={10}
                  fill="#3b82f6"
                  opacity={0.3}
                  animate={{ 
                    r: [8, 14, 8],
                    opacity: [0.4, 0.2, 0.4]
                  }}
                  transition={{ 
                    duration: 2.5, 
                    delay: i * 0.1,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
                {/* Core */}
                <circle
                  r={4}
                  fill="#2563eb"
                  stroke="white"
                  strokeWidth={2}
                />
              </g>
            </Marker>
          ))}
        </ComposableMap>
      </div>

      {/* Pacchetti di dati animati - cerchi che si muovono sulle connessioni */}
      <div className="absolute inset-0">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 140,
            center: [10, 30]
          }}
          style={{
            width: '100%',
            height: '100%',
          }}
        >
          {connections.slice(0, 8).map((conn, i) => {
            const from = markers[conn.from];
            const to = markers[conn.to];
            
            // Calcola punto medio per l'animazione
            const midX = (from.coordinates[0] + to.coordinates[0]) / 2;
            const midY = (from.coordinates[1] + to.coordinates[1]) / 2;
            
            return (
              <Marker
                key={`packet-${i}`}
                coordinates={[midX, midY]}
              >
                <motion.circle
                  r={5}
                  fill="#3b82f6"
                  initial={{ 
                    cx: from.coordinates[0] - midX, 
                    cy: from.coordinates[1] - midY,
                    opacity: 0 
                  }}
                  animate={{ 
                    cx: [from.coordinates[0] - midX, to.coordinates[0] - midX],
                    cy: [from.coordinates[1] - midY, to.coordinates[1] - midY],
                    opacity: [0, 1, 1, 0]
                  }}
                  transition={{ 
                    duration: 3, 
                    delay: i * 0.5,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                />
              </Marker>
            );
          })}
        </ComposableMap>
      </div>

      {/* Overlay per leggibilità testo */}
      <div className="absolute inset-0 bg-gradient-to-r from-white via-white/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-white/40 via-transparent to-white/20" />
    </div>
  );
};

export default WorldMapBackground;

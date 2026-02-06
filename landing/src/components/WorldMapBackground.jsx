import { motion } from 'framer-motion';
import { ComposableMap, Geographies, Geography, Marker, Line } from 'react-simple-maps';

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

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

// Connessioni
const connections = [
  { from: 0, to: 2 }, { from: 0, to: 3 }, { from: 2, to: 3 },
  { from: 2, to: 6 }, { from: 3, to: 4 }, { from: 3, to: 10 },
  { from: 4, to: 5 }, { from: 6, to: 7 }, { from: 6, to: 8 },
  { from: 6, to: 9 }, { from: 7, to: 8 }, { from: 9, to: 10 },
  { from: 10, to: 5 }, { from: 0, to: 1 }, { from: 1, to: 7 },
  { from: 1, to: 6 }, { from: 0, to: 11 }, { from: 11, to: 5 },
];

const WorldMapBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50" />
      
      <div className="absolute inset-0 opacity-50">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 140, center: [10, 30] }}
          style={{ width: '100%', height: '100%' }}
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
                  style={{ default: { outline: 'none' }, hover: { outline: 'none' }, pressed: { outline: 'none' } }}
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

          {/* Pacchetti animati che viaggiano */}
          {connections.slice(0, 10).map((conn, i) => (
            <Line
              key={`packet-${i}`}
              from={markers[conn.from].coordinates}
              to={markers[conn.to].coordinates}
              stroke="#2563eb"
              strokeWidth={4}
              strokeLinecap="round"
              style={{
                filter: 'drop-shadow(0 0 4px #3b82f6)',
              }}
            >
              <animate
                attributeName="stroke-dasharray"
                values="0 1000;10 1000"
                dur="0.1s"
                fill="freeze"
              />
              <animate
                attributeName="stroke-dashoffset"
                values="1000;0"
                dur={`${2 + i * 0.3}s`}
                begin={`${i * 0.4}s`}
                repeatCount="indefinite"
              />
            </Line>
          ))}

          {/* Marker Data Centers */}
          {markers.map((marker, i) => (
            <Marker key={marker.name} coordinates={marker.coordinates}>
              <g>
                <motion.circle
                  r={10}
                  fill="#3b82f6"
                  opacity={0.3}
                  animate={{ r: [8, 14, 8], opacity: [0.4, 0.2, 0.4] }}
                  transition={{ duration: 2.5, delay: i * 0.1, repeat: Infinity, ease: "easeInOut" }}
                />
                <circle r={4} fill="#2563eb" stroke="white" strokeWidth={2} />
              </g>
            </Marker>
          ))}
        </ComposableMap>
      </div>

      <div className="absolute inset-0 bg-gradient-to-r from-white via-white/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-white/40 via-transparent to-white/20" />
    </div>
  );
};

export default WorldMapBackground;

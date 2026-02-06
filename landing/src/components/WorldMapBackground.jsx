import { motion } from 'framer-motion';

const WorldMapBackground = () => {
  // Locations dei data center (coordinate relative 0-1000)
  const locations = [
    { id: 'milan', name: 'Milan', x: 520, y: 180 },
    { id: 'london', name: 'London', x: 480, y: 160 },
    { id: 'paris', name: 'Paris', x: 490, y: 175 },
    { id: 'frankfurt', name: 'Frankfurt', x: 510, y: 170 },
    { id: 'ny', name: 'New York', x: 280, y: 190 },
    { id: 'la', name: 'Los Angeles', x: 180, y: 210 },
    { id: 'saopaulo', name: 'São Paulo', x: 340, y: 320 },
    { id: 'singapore', name: 'Singapore', x: 720, y: 260 },
    { id: 'tokyo', name: 'Tokyo', x: 780, y: 200 },
    { id: 'sydney', name: 'Sydney', x: 820, y: 340 },
    { id: 'dubai', name: 'Dubai', x: 620, y: 220 },
    { id: 'mumbai', name: 'Mumbai', x: 680, y: 240 },
    { id: 'capetown', name: 'Cape Town', x: 540, y: 380 },
    { id: 'moscow', name: 'Moscow', x: 600, y: 140 },
  ];

  // Connessioni principali
  const connections = [
    { from: 'milan', to: 'london' },
    { from: 'milan', to: 'frankfurt' },
    { from: 'milan', to: 'paris' },
    { from: 'london', to: 'ny' },
    { from: 'frankfurt', to: 'dubai' },
    { from: 'dubai', to: 'singapore' },
    { from: 'dubai', to: 'mumbai' },
    { from: 'singapore', to: 'tokyo' },
    { from: 'singapore', to: 'sydney' },
    { from: 'singapore', to: 'mumbai' },
    { from: 'ny', to: 'la' },
    { from: 'ny', to: 'saopaulo' },
    { from: 'ny', to: 'london' },
    { from: 'la', to: 'tokyo' },
    { from: 'la', to: 'singapore' },
    { from: 'saopaulo', to: 'capetown' },
    { from: 'moscow', to: 'singapore' },
    { from: 'moscow', to: 'frankfurt' },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50/50" />
      
      {/* World Map SVG */}
      <svg 
        viewBox="0 0 1000 500" 
        className="absolute w-full h-full opacity-40"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Continenti stilizzati in colori molto chiari */}
        <g fill="#dbeafe" opacity="0.5">
          {/* Nord America */}
          <path d="M120 100 Q180 80 250 110 T320 180 Q300 250 230 280 T130 230 Q80 180 120 100" />
          {/* Canada */}
          <path d="M140 80 Q200 60 280 90 T320 120 Q280 100 220 100 T140 80" />
          
          {/* Sud America */}
          <path d="M260 300 Q300 280 320 330 T300 430 Q260 460 240 400 T260 300" />
          
          {/* Europa */}
          <path d="M450 120 Q520 100 580 130 T600 180 Q550 200 500 180 T450 120" />
          
          {/* Africa */}
          <path d="M460 220 Q520 200 560 260 T540 380 Q480 400 460 340 T460 220" />
          
          {/* Asia */}
          <path d="M600 120 Q750 80 850 130 T900 230 Q850 280 750 260 T600 180 Q580 150 600 120" />
          
          {/* India */}
          <path d="M660 220 Q700 210 720 250 T700 320 Q660 310 660 270 T660 220" />
          
          {/* Australia */}
          <path d="M760 340 Q820 320 860 350 T840 410 Q780 430 760 390 T760 340" />
          
          {/* Giappone */}
          <path d="M800 180 Q820 170 830 200 T810 240 Q790 230 800 200 T800 180" />
        </g>

        {/* Connessioni - linee sottili */}
        {connections.map((conn, i) => {
          const from = locations.find(l => l.id === conn.from);
          const to = locations.find(l => l.id === conn.to);
          return (
            <motion.line
              key={i}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="#93c5fd"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.5 }}
              transition={{ duration: 2.5, delay: i * 0.08 }}
            />
          );
        })}

        {/* Pacchetti di dati che viaggiano */}
        {connections.slice(0, 6).map((conn, i) => {
          const from = locations.find(l => l.id === conn.from);
          const to = locations.find(l => l.id === conn.to);
          return (
            <motion.circle
              key={`pulse-${i}`}
              r="5"
              fill="#3b82f6"
              initial={{ 
                cx: from.x, 
                cy: from.y,
                opacity: 0,
                scale: 0
              }}
              animate={{ 
                cx: [from.x, to.x],
                cy: [from.y, to.y],
                opacity: [0, 1, 1, 0],
                scale: [0.5, 1, 1, 0.5]
              }}
              transition={{ 
                duration: 4, 
                delay: i * 0.6,
                repeat: Infinity,
                ease: "linear"
              }}
            />
          );
        })}

        {/* Location points */}
        {locations.map((loc, index) => (
          <g key={loc.id}>
            {/* Glow effect animato */}
            <motion.circle
              cx={loc.x}
              cy={loc.y}
              r="15"
              fill="#3b82f6"
              opacity="0.15"
              animate={{ 
                r: [12, 20, 12],
                opacity: [0.2, 0.1, 0.2]
              }}
              transition={{ 
                duration: 3, 
                delay: index * 0.2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            {/* Core */}
            <circle
              cx={loc.x}
              cy={loc.y}
              r="6"
              fill="#3b82f6"
            />
            {/* Inner highlight */}
            <circle
              cx={loc.x}
              cy={loc.y}
              r="3"
              fill="#60a5fa"
            />
          </g>
        ))}
      </svg>

      {/* Overlay gradient per leggibilità testo */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/80 via-white/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-white/60 via-transparent to-white/30" />
    </div>
  );
};

export default WorldMapBackground;

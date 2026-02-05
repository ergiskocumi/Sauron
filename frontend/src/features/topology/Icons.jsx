import React from 'react';

export const FirewallIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Contenitore con soft background */}
    <rect width="48" height="48" rx="12" fill="#F0F9FF" />
    
    {/* Ombra del Firewall */}
    <rect x="10" y="18" width="28" height="18" rx="3" fill="#1E3A8A" opacity="0.2" />

    {/* Chassis Principale (Appliance rack-mount style) */}
    <rect x="8" y="16" width="32" height="18" rx="2" fill="#1D4ED8" stroke="#1E3A8A" strokeWidth="1.5" />
    
    {/* Pattern a Mattoni (Iconico Firewall) */}
    <g opacity="0.8">
      {/* Riga 1 */}
      <path d="M12 20H18M21 20H27M30 20H36" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M19.5 17V20M28.5 17V20" stroke="#1E3A8A" strokeWidth="1" />
      
      {/* Riga 2 (Sfasata) */}
      <path d="M10 24H15M18 24H24M27 24H33M36 24" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16.5 21V24M25.5 21V24M34.5 21V24" stroke="#1E3A8A" strokeWidth="1" />
      
      {/* Riga 3 */}
      <path d="M12 28H18M21 28H27M30 28H36" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M19.5 25V28M28.5 25V28" stroke="#1E3A8A" strokeWidth="1" />
    </g>

    {/* Dettagli Cybersecurity: Status LEDs */}
    <circle cx="12" cy="31" r="1" fill="#10B981" />
    <circle cx="15" cy="31" r="1" fill="#10B981" />
    
    {/* Riflesso superiore per profondità */}
    <path d="M8 18C8 17.5 8.5 16 10 16H38C39.5 16 40 17.5 40 18" stroke="white" strokeOpacity="0.3" strokeWidth="1" />
  </svg>
);

export const RouterIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="12" fill="#F0F9FF" />
    
    {/* Router Body (Circular/Cylindrical Appliance) */}
    <circle cx="24" cy="24" r="16" fill="#1D4ED8" stroke="#1E3A8A" strokeWidth="1.5" />
    <circle cx="24" cy="24" r="13" stroke="#60A5FA" strokeWidth="1.5" strokeDasharray="4 2" />

    {/* Routing Arrows (Digital look) */}
    <path d="M24 16V32M16 24L24 16L32 24M16 24L32 24M24 32L32 24" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
    
    {/* Highlight Ring */}
    <circle cx="24" cy="24" r="15.5" stroke="white" strokeOpacity="0.2" strokeWidth="1" />
  </svg>
);

export const SwitchIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="12" fill="#F0F9FF" />
    
    {/* Switch Chassis */}
    <rect x="6" y="16" width="36" height="16" rx="2" fill="#334155" stroke="#1E293B" strokeWidth="1.5" />
    
    {/* Port Grid (High Density) */}
    <g transform="translate(10, 20)">
      {Array.from({ length: 8 }).map((_, i) => (
        <rect key={i} x={i * 3.5} y="0" width="2" height="3" rx="0.5" fill={i % 3 === 0 ? "#10B981" : "#475569"} />
      ))}
      {Array.from({ length: 8 }).map((_, i) => (
        <rect key={i+8} x={i * 3.5} y="5" width="2" height="3" rx="0.5" fill={i === 4 ? "#F59E0B" : "#475569"} />
      ))}
    </g>

    {/* Front Panel Accents */}
    <rect x="6" y="16" width="36" height="2" fill="white" opacity="0.1" />
    <path d="M38 20V28M40 20V28" stroke="#60A5FA" strokeWidth="1" opacity="0.5" />
  </svg>
);

export const HostIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="12" fill="#F0F9FF" />
    
    {/* Monitor / Screen */}
    <rect x="10" y="12" width="28" height="18" rx="2" fill="#1E293B" stroke="#334155" strokeWidth="1.5" />
    <rect x="12" y="14" width="24" height="12" rx="1" fill="#475569" opacity="0.1" />
    
    {/* UI Elements inside screen */}
    <path d="M14 18H18M14 21H22" stroke="#60A5FA" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
    
    {/* Desktop Stand */}
    <path d="M20 30L18 34H30L28 30" stroke="#334155" strokeWidth="1.5" fill="#1E293B" />
    <path d="M16 36H32" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const CloudIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="12" fill="#F0F9FF" />
    
    {/* Stylized Professional Cloud */}
    <path d="M35 32C37.2 32 39 30.2 39 28C39 26.1 37.7 24.5 36 24.1C35.8 20.7 32.9 18 29.5 18C27.9 18 26.5 18.6 25.4 19.5C23.9 17.4 21.3 16 18.5 16C13.8 16 10 19.8 10 24.5C10 25.4 10.1 26.2 10.4 27C8.4 27.6 7 29.4 7 31.5C7 34 9 36 11.5 36H34.5C37 36 39 34 39 31.5" 
      fill="#DBEAFE" stroke="#3B82F6" strokeWidth="1.5" strokeLinejoin="round" />
    
    {/* Internal Depth */}
    <circle cx="18" cy="24" r="2" fill="#60A5FA" opacity="0.3" />
    <circle cx="28" cy="26" r="3" fill="#60A5FA" opacity="0.2" />
  </svg>
);

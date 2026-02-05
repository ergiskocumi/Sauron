import React from 'react';

export const FirewallIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fw-bg" x1="8" y1="8" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#DBEAFE" />
        <stop offset="1" stopColor="#BFDBFE" />
      </linearGradient>
      <linearGradient id="fw-stroke" x1="12" y1="12" x2="36" y2="36" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#3B82F6" />
        <stop offset="1" stopColor="#1D4ED8" />
      </linearGradient>
    </defs>
    <rect width="48" height="48" rx="10" fill="url(#fw-bg)" />
    <rect x="10" y="12" width="28" height="24" rx="4" stroke="url(#fw-stroke)" strokeWidth="2.2" fill="white" />
    <path d="M10 20H38" stroke="#3B82F6" strokeWidth="2" />
    <path d="M10 28H38" stroke="#3B82F6" strokeWidth="2" />
    <path d="M18 12V36" stroke="#60A5FA" strokeWidth="2" />
    <path d="M26 12V36" stroke="#60A5FA" strokeWidth="2" />
    <path d="M34 12V36" stroke="#60A5FA" strokeWidth="2" />
    <path d="M24 16L26 18L24 20L22 18Z" fill="#1D4ED8" />
  </svg>
);

export const RouterIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="20" fill="#3B82F6" fillOpacity="0.1" stroke="#3B82F6" strokeWidth="2" />
    <path d="M16 24H32M32 24L28 20M32 24L28 28M16 24L20 20M16 24L20 28" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const SwitchIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="16" width="32" height="16" rx="4" fill="#6366F1" fillOpacity="0.1" stroke="#6366F1" strokeWidth="2" />
    <path d="M14 24H18M22 24H26M30 24H34" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" />
    <path d="M14 20L18 28M18 20L14 28M22 20L26 28M26 20L22 28M30 20L34 28M34 20L30 28" stroke="#6366F1" strokeWidth="1" strokeLinecap="round" />
  </svg>
);

export const HostIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="8" width="28" height="20" rx="3" fill="#64748B" fillOpacity="0.1" stroke="#64748B" strokeWidth="2" />
    <path d="M14 36H34M24 28V36M18 40H30" stroke="#64748B" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const CloudIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M36.12 30.2C38.48 29.47 40 27.27 40 24.8C40 21.6 37.4 19 34.2 19C33.88 19 33.56 19.03 33.25 19.1C32.18 15.54 28.91 13 25 13C21.17 13 17.96 15.42 16.82 18.84C16.24 18.43 15.54 18.2 14.8 18.2C12.3 18.2 10.27 20.06 10.02 22.46C7.68 23.47 6 25.75 6 28.4C6 32.27 9.13 35.4 13 35.4H35C38.31 35.4 41 32.71 41 29.4C41 27.63 40.23 26.04 39 24.95" fill="#94A3B8" fillOpacity="0.1" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

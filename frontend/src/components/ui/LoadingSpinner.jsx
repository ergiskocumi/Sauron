/**
 * LOADING SPINNER COMPONENT
 *
 * Indicatore di caricamento riutilizzabile.
 * Rispetta le preferenze di reduced motion dell'utente.
 */

import { useReducedMotion } from '../../hooks/useReducedMotion';

const SIZE_MAP = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

const STROKE_MAP = {
  sm: 3,
  md: 4,
  lg: 4,
  xl: 5,
};

export const LoadingSpinner = ({ 
  size = 'md', 
  message = 'Caricamento...',
  className = '',
}) => {
  const shouldReduceMotion = useReducedMotion();
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md;
  const strokeWidth = STROKE_MAP[size] || STROKE_MAP.md;

  // Per utenti con reduced motion, mostra un indicatore statico pulsing
  if (shouldReduceMotion) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 gap-4 ${className}`}>
        <div 
          className={`${sizeClass} rounded-full border-4 border-blue-100 border-t-blue-600`}
          role="status"
          aria-label={message}
        />
        {message && (
          <p className="text-sm text-slate-600 font-medium" aria-live="polite">
            {message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center p-8 gap-3 ${className}`}>
      <svg
        className={`animate-spin text-blue-600 ${sizeClass}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        role="status"
        aria-label={message}
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth={strokeWidth}
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {message && (
        <p className="text-sm text-slate-600 font-medium" aria-live="polite">
          {message}
        </p>
      )}
    </div>
  );
};

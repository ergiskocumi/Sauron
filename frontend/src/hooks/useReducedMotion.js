/**
 * useReducedMotion Hook
 * 
 * Rispetta le preferenze di accessibilità dell'utente riguardo alle animazioni.
 * Se l'utente ha impostato "riduci movimento" nel sistema, le animazioni
 * verranno disabilitate o ridotte al minimo.
 * 
 * Usage:
 *   const shouldReduceMotion = useReducedMotion();
 *   <motion.div animate={shouldReduceMotion ? false : { opacity: 1 }} />
 */
import { useState, useEffect } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

export function useReducedMotion() {
  const [shouldReduceMotion, setShouldReduceMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(QUERY);
    
    const handleChange = (event) => {
      setShouldReduceMotion(event.matches);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    
    // Legacy support
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  return shouldReduceMotion;
}

export default useReducedMotion;

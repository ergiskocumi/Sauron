/**
 * USE PATH HOOK - Path Calculation State Management
 *
 * Custom hook per gestire il ciclo di vita del calcolo percorso.
 * Incapsula la logica di loading, error e path result.
 *
 * Pattern Applicato:
 * - Custom Hook: Riutilizzabilità della logica di pathfinding
 * - Separation of Concerns: Il componente non deve gestire gli stati interni
 *
 * Uso:
 *   const { pathResult, loading, error, calculatePath, resetPath } = usePath();
 *
 * Stati:
 * - loading: true durante il calcolo
 * - error: stringa con messaggio errore o null
 * - pathResult: oggetto con nodi e link evidenziati
 * - calculatePath: funzione per calcolare il percorso
 * - resetPath: funzione per pulire il percorso visualizzato
 */

import { useState } from 'react';
import {
  calculatePath as apiCalculatePath,
  formatPathForVisualization,
} from '../services/pathService';

export const usePath = () => {
  const [pathResult, setPathResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Calcola il percorso chiamando il backend
   *
   * @param {string} source - Node key sorgente
   * @param {string} destination - IP destinazione
   * @param {number} maxTtl - Max hop count
   */
  const calculatePath = async (source, destination, maxTtl = 64) => {
    try {
      setLoading(true);
      setError(null);

      // Valida input
      if (!source || !source.trim()) {
        throw new Error('Sorgente non selezionata');
      }

      if (!destination || !destination.trim()) {
        throw new Error('Destinazione non specificata');
      }

      // Chiama API
      const rawResult = await apiCalculatePath(source, destination, maxTtl);

      // Formatta per visualizzazione
      const formatted = formatPathForVisualization(rawResult);

      setPathResult(formatted);

      return formatted;
    } catch (err) {
      setError(err.message);
      setPathResult(null);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Reset del percorso visualizzato
   */
  const resetPath = () => {
    setPathResult(null);
    setError(null);
  };

  return {
    pathResult,
    loading,
    error,
    calculatePath,
    resetPath,
  };
};

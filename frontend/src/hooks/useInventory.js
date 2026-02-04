/**
 * USE INVENTORY HOOK - State Management
 *
 * Custom hook per gestire il ciclo di vita del fetching dell'inventario.
 * Incapsula la logica di loading, error e data in un unico hook riutilizzabile.
 *
 * Pattern Applicato:
 * - Custom Hook: Riutilizzabilità della logica di fetching
 * - Separation of Concerns: Il componente non deve gestire gli stati interni
 *
 * Uso:
 *   const { inventory, loading, error, refetch } = useInventory();
 *
 * Stati:
 * - loading: true durante il fetch iniziale
 * - error: stringa con messaggio errore o null
 * - inventory: array di firewall o []
 * - refetch: funzione per ricaricare i dati
 */

import { useState, useEffect } from 'react';
import { getInventory } from '../services/inventoryService';

export const useInventory = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Funzione di fetch con gestione completa degli stati
   */
  const fetchInventory = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getInventory();
      setInventory(data);
    } catch (err) {
      setError(err.message);
      setInventory([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch automatico al mount del componente
   */
  useEffect(() => {
    fetchInventory();
  }, []);

  /**
   * Funzione per ricaricare manualmente i dati
   */
  const refetch = () => {
    fetchInventory();
  };

  return {
    inventory,
    loading,
    error,
    refetch,
  };
};

import { useState, useEffect, useCallback } from 'react';
import { getInventory } from '../services/inventoryService';

export const useInventory = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInventory = useCallback(async (signal) => {
    try {
      setLoading(true);
      setError(null);

      const data = await getInventory();

      if (!signal?.aborted) {
        setInventory(data);
      }
    } catch (err) {
      if (!signal?.aborted) {
        setError(err.message);
        setInventory([]);
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchInventory(controller.signal);
    return () => controller.abort();
  }, [fetchInventory]);

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

import { useState, useEffect, useCallback, useRef } from 'react';
import { getInventory, getInventoryHealth } from '../services/inventoryService';

export const useInventory = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [healthById, setHealthById] = useState({});
  const [healthError, setHealthError] = useState(null);
  const healthTimerRef = useRef(null);

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

  const fetchHealth = useCallback(async () => {
    try {
      setHealthError(null);
      const data = await getInventoryHealth();
      const map = Array.isArray(data)
        ? data.reduce((acc, item) => {
            acc[item.id] = item;
            return acc;
          }, {})
        : {};
      setHealthById(map);
    } catch (err) {
      setHealthError(err.message);
    }
  }, []);

  useEffect(() => {
    if (!inventory.length) {
      setHealthById({});
      return;
    }

    fetchHealth();

    if (healthTimerRef.current) {
      clearInterval(healthTimerRef.current);
    }
    healthTimerRef.current = setInterval(fetchHealth, 15000);

    return () => {
      if (healthTimerRef.current) {
        clearInterval(healthTimerRef.current);
        healthTimerRef.current = null;
      }
    };
  }, [inventory.length, fetchHealth]);

  const refetch = () => {
    fetchInventory();
  };

  return {
    inventory,
    loading,
    error,
    healthById,
    healthError,
    refetch,
  };
};

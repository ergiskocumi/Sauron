import { useState, useEffect, useCallback } from 'react';
import { getSystemInfo } from '../services/systemService';

export const useSystemInfo = () => {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInfo = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSystemInfo();
      setInfo(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInfo();
  }, [fetchInfo]);

  return {
    info,
    loading,
    error,
    refetch: fetchInfo,
  };
};

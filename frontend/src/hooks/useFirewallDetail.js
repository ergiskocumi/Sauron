import { useState, useEffect, useCallback } from 'react';
import { getFirewallDetail } from '../services/firewallDetailService';

/**
 * Hook per caricare il dettaglio completo di un firewall.
 *
 * @param {string|null} deviceId - ID del firewall da caricare
 * @returns {{ data, loading, error, refetch }}
 */
export const useFirewallDetail = (deviceId) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDetail = useCallback(async (signal) => {
    if (!deviceId) return;

    try {
      setLoading(true);
      setError(null);

      const result = await getFirewallDetail(deviceId);

      if (!signal?.aborted) {
        setData(result);
      }
    } catch (err) {
      if (!signal?.aborted) {
        setError(err.message);
        setData(null);
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [deviceId]);

  useEffect(() => {
    if (!deviceId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    fetchDetail(controller.signal);
    return () => controller.abort();
  }, [fetchDetail, deviceId]);

  const refetch = useCallback(() => {
    fetchDetail();
  }, [fetchDetail]);

  return { data, loading, error, refetch };
};

import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import apiClient from '../api/client';

export const useHeartbeat = (firewalls = []) => {
  const [statuses, setStatuses] = useState({});
  const prevStatusesRef = useRef({});

  const checkStatus = useCallback(async (firewall, signal) => {
    try {
      await apiClient.get('/api/inventory', { signal });

      setStatuses(prev => {
        const newStatuses = { ...prev, [firewall.id]: 'online' };

        // Notifica solo su cambio di stato da offline a online
        if (prevStatusesRef.current[firewall.id] === 'offline') {
          toast.success(`Firewall ${firewall.id} tornato online`, {
            id: `hb-${firewall.id}`,
          });
        }

        prevStatusesRef.current = newStatuses;
        return newStatuses;
      });
    } catch (error) {
      if (signal?.aborted) return;

      setStatuses(prev => {
        const newStatuses = { ...prev, [firewall.id]: 'offline' };

        // Notifica solo sul primo cambio a offline
        if (prevStatusesRef.current[firewall.id] !== 'offline') {
          toast.error(`Firewall ${firewall.id} non raggiungibile`, {
            id: `hb-${firewall.id}`,
          });
        }

        prevStatusesRef.current = newStatuses;
        return newStatuses;
      });
    }
  }, []);

  useEffect(() => {
    if (firewalls.length === 0) return;

    const controller = new AbortController();

    const runChecks = () => {
      firewalls.forEach(fw => {
        if (fw.enabled) checkStatus(fw, controller.signal);
      });
    };

    runChecks();
    const interval = setInterval(runChecks, 60000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [firewalls, checkStatus]);

  return statuses;
};

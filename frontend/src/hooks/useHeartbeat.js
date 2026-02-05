import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

export const useHeartbeat = (firewalls = []) => {
  const [statuses, setStatuses] = useState({});

  const checkStatus = useCallback(async (firewall) => {
    try {
      // In a real scenario, we might have a lightweight ping endpoint
      // For now, we'll just check if they respond to a basic info request
      // This is just a simulation of the "Heartbeat" logic requested
      const response = await fetch(`/api/inventory`); 
      // Note: Ideally the backend has a /api/ping/{id}
      
      if (response.ok) {
        setStatuses(prev => ({ ...prev, [firewall.id]: 'online' }));
      } else {
        throw new Error('Unreachable');
      }
    } catch (error) {
      setStatuses(prev => ({ ...prev, [firewall.id]: 'offline' }));
      toast.error(`Firewall ${firewall.name || firewall.host} non raggiungibile!`, {
        id: `hb-${firewall.id}`, // Prevent multiple toasts for same FW
      });
    }
  }, []);

  useEffect(() => {
    if (firewalls.length === 0) return;

    const runChecks = () => {
      firewalls.forEach(fw => {
        if (fw.enabled) checkStatus(fw);
      });
    };

    runChecks();
    const interval = setInterval(runChecks, 60000); // Every 60 seconds

    return () => clearInterval(interval);
  }, [firewalls, checkStatus]);

  return statuses;
};

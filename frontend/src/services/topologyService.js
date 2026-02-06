/**
 * TOPOLOGY SERVICE - Adapter Pattern
 *
 * Astrae le chiamate API per la topologia di rete.
 * I componenti React NON devono mai importare Axios direttamente.
 *
 * Uso:
 *   import { getFirewallTopology } from '@/services/topologyService';
 *   const data = await getFirewallTopology('fw-milano');
 */

import apiClient from '../api/client';
import { extractErrorMessage } from '../utils/errors';

/**
 * Ottiene la topologia interna di un singolo firewall.
 *
 * @param {string} deviceId - ID del firewall (es. "fw-milano")
 * @param {boolean} excludeDefault - Se true, esclude le default route (default: true)
 * @returns {Promise<Object>} FirewallTopologyResponse
 * @throws {Error} Se la richiesta fallisce
 */
export const getFirewallTopology = async (deviceId, excludeDefault = true) => {
  try {
    const response = await apiClient.get(
      `/api/topology/firewall/${deviceId}`,
      { params: { exclude_default: excludeDefault } }
    );
    return response.data;
  } catch (error) {
    console.error('[TopologyService] Failed to get firewall topology:', error);
    throw new Error(extractErrorMessage(error, 'Errore nel caricamento della topologia firewall'));
  }
};

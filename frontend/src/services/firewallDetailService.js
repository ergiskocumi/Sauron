/**
 * FIREWALL DETAIL SERVICE - Adapter Pattern
 *
 * Astrae le chiamate API per il dettaglio di un singolo firewall.
 *
 * Uso:
 *   import { getFirewallDetail } from '@/services/firewallDetailService';
 *   const data = await getFirewallDetail('Firewall Wetechs Calenzano');
 */

import apiClient from '../api/client';
import { extractErrorMessage } from '../utils/errors';

/**
 * Ottiene il dettaglio completo di un singolo firewall.
 * Combina dati live (CPU, RAM, policies) con dati snapshot (interfaces, routes).
 *
 * @param {string} deviceId - ID del firewall
 * @returns {Promise<Object>} FirewallDetailResponse
 * @throws {Error} Se la richiesta fallisce
 */
export const getFirewallDetail = async (deviceId) => {
  try {
    const response = await apiClient.get(
      `/api/firewall/${encodeURIComponent(deviceId)}/detail`
    );
    return response.data;
  } catch (error) {
    console.error('[FirewallDetailService] Failed to get firewall detail:', error);
    throw new Error(extractErrorMessage(error, 'Errore nel caricamento del dettaglio firewall'));
  }
};

/**
 * INVENTORY SERVICE - Adapter Pattern
 *
 * Astrae le chiamate API per l'inventario firewall.
 * I componenti React NON devono mai importare Axios direttamente.
 *
 * Pattern Applicato:
 * - Adapter: Converte i dati raw del backend in formati comodi per la UI
 * - Single Responsibility: Solo operazioni legate all'inventario
 *
 * Uso:
 *   import { getInventory } from '@/services/inventoryService';
 *   const firewalls = await getInventory();
 */

import apiClient from '../api/client';
import { extractErrorMessage } from '../utils/errors';

/**
 * Recupera la lista completa dei firewall dall'inventario
 *
 * @returns {Promise<Array>} Lista di firewall configurati
 * @throws {Error} Se la richiesta fallisce
 *
 * Esempio risposta:
 * [
 *   {
 *     id: "fw-milano",
 *     host: "10.101.201.1:10443",
 *     entry_vdom: "root",
 *     enabled: true
 *   }
 * ]
 */
export const getInventory = async () => {
  try {
    const response = await apiClient.get('/api/inventory');
    return response.data;
  } catch (error) {
    console.error('[InventoryService] Failed to fetch inventory:', error);
    throw new Error(extractErrorMessage(error, 'Errore nel caricamento dell\'inventario'));
  }
};

/**
 * Recupera lo stato live di raggiungibilità dei firewall
 *
 * @returns {Promise<Array>} Lista con stati { id, reachable, latency_ms, error, checked_at }
 * @throws {Error} Se la richiesta fallisce
 */
export const getInventoryHealth = async () => {
  try {
    const response = await apiClient.get('/api/inventory/health');
    return response.data;
  } catch (error) {
    console.error('[InventoryService] Failed to fetch inventory health:', error);
    throw new Error(extractErrorMessage(error, 'Errore nel controllo stato firewall'));
  }
};

/**
 * Aggiunge un nuovo firewall all'inventario
 *
 * @param {Object} firewall - Dati del firewall { id, host, token }
 * @returns {Promise<Object>} Risposta con status, message e firewall aggiunto
 * @throws {Error} Se la richiesta fallisce (duplicato, validazione, ecc.)
 */
export const addFirewall = async (firewall) => {
  try {
    const response = await apiClient.post('/api/inventory', firewall);
    return response.data;
  } catch (error) {
    throw new Error(extractErrorMessage(error, 'Errore nell\'aggiunta del firewall'));
  }
};

/**
 * Conta i firewall abilitati e disabilitati
 *
 * @param {Array} inventory - Lista di firewall
 * @returns {Object} Statistiche { total, enabled, disabled }
 */
export const getInventoryStats = (inventory) => {
  if (!Array.isArray(inventory)) {
    return { total: 0, enabled: 0, disabled: 0 };
  }

  const enabled = inventory.filter((fw) => fw.enabled).length;
  const disabled = inventory.length - enabled;

  return {
    total: inventory.length,
    enabled,
    disabled,
  };
};

/**
 * Filtra i firewall per stato (enabled/disabled)
 *
 * @param {Array} inventory - Lista di firewall
 * @param {boolean} enabled - Se true, restituisce solo abilitati
 * @returns {Array} Lista filtrata
 */
export const filterByStatus = (inventory, enabled = true) => {
  if (!Array.isArray(inventory)) {
    return [];
  }
  return inventory.filter((fw) => fw.enabled === enabled);
};

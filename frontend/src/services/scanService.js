import apiClient from '../api/client';
import { extractErrorMessage } from '../utils/errors';

/**
 * Avvia una scansione di rete in background.
 *
 * @returns {Promise<Object>} Risposta con status e message
 * @throws {Error} Se la richiesta fallisce
 */
export const startScan = async () => {
  try {
    const response = await apiClient.post('/api/scan');
    return response.data;
  } catch (error) {
    throw new Error(extractErrorMessage(error, 'Errore nell\'avvio della scansione'));
  }
};

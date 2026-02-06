/**
 * SYSTEM SERVICE - Adapter Pattern
 *
 * Recupera informazioni di sistema dal backend.
 */

import apiClient from '../api/client';
import { extractErrorMessage } from '../utils/errors';

export const getSystemInfo = async () => {
  try {
    const response = await apiClient.get('/api/system/info');
    return response.data;
  } catch (error) {
    console.error('[SystemService] Failed to fetch system info:', error);
    throw new Error(extractErrorMessage(error, 'Errore nel recupero informazioni di sistema'));
  }
};

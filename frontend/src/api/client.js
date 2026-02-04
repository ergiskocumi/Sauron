/**
 * API CLIENT - Singleton Pattern
 *
 * Configurazione centralizzata per tutte le chiamate HTTP.
 *
 * Pattern Applicato:
 * - Singleton: Un'unica istanza di Axios configurata per tutta l'app
 * - Interceptors: Gestione centralizzata di logging e errori
 *
 * Uso:
 *   import apiClient from '@/api/client';
 *   const response = await apiClient.get('/api/inventory');
 */

import axios from 'axios';

// Configurazione da environment variables
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const TIMEOUT = import.meta.env.VITE_API_TIMEOUT || 30000;

/**
 * Singleton Axios Instance
 */
const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request Interceptor - Logging e autenticazione futura
 */
apiClient.interceptors.request.use(
  (config) => {
    // Log richiesta in development
    if (import.meta.env.DEV) {
      console.log(`[API] ${config.method.toUpperCase()} ${config.url}`);
    }

    // TODO: Aggiungere token JWT se necessario
    // config.headers.Authorization = `Bearer ${token}`;

    return config;
  },
  (error) => {
    console.error('[API] Request Error:', error);
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor - Gestione errori centralizzata
 */
apiClient.interceptors.response.use(
  (response) => {
    // Log risposta in development
    if (import.meta.env.DEV) {
      console.log(`[API] Response ${response.status}:`, response.data);
    }
    return response;
  },
  (error) => {
    // Gestione errori HTTP centralizzata
    if (error.response) {
      // Errore dal server (4xx, 5xx)
      const { status, data } = error.response;
      console.error(`[API] HTTP ${status}:`, data.detail || data);

      // Messaggi user-friendly
      const errorMessages = {
        400: 'Richiesta non valida',
        401: 'Non autorizzato',
        403: 'Accesso negato',
        404: 'Risorsa non trovata',
        500: 'Errore interno del server',
        503: 'Servizio non disponibile',
      };

      error.userMessage = errorMessages[status] || 'Errore sconosciuto';
    } else if (error.request) {
      // Richiesta inviata ma nessuna risposta (backend offline)
      console.error('[API] No Response:', error.message);
      error.userMessage = 'Impossibile contattare il server. Verifica che il backend sia avviato.';
    } else {
      // Errore nella configurazione della richiesta
      console.error('[API] Request Setup Error:', error.message);
      error.userMessage = 'Errore nella configurazione della richiesta';
    }

    return Promise.reject(error);
  }
);

export default apiClient;

/**
 * Helper per verificare la connessione al backend
 */
export const checkApiHealth = async () => {
  try {
    const response = await apiClient.get('/');
    return response.status === 200;
  } catch (error) {
    return false;
  }
};

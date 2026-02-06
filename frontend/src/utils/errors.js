/**
 * Estrae un messaggio di errore leggibile da un errore Axios o generico.
 *
 * @param {Error} error - Errore catturato
 * @param {string} fallback - Messaggio di fallback
 * @returns {string} Messaggio user-friendly
 */
export const extractErrorMessage = (error, fallback = 'Errore sconosciuto') => {
  if (error?.response?.data?.detail) {
    return error.response.data.detail;
  }
  if (error?.userMessage) {
    return error.userMessage;
  }
  if (error?.message) {
    return error.message;
  }
  return fallback;
};

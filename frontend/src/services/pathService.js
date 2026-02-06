/**
 * PATH SERVICE - Adapter Pattern
 *
 * Astrae le chiamate API per il pathfinding (simulazione percorsi).
 * I componenti React NON devono mai importare Axios direttamente.
 *
 * Pattern Applicato:
 * - Adapter: Converte i dati raw del backend in formati comodi per la UI
 * - Single Responsibility: Solo operazioni legate al pathfinding
 *
 * Uso:
 *   import { calculatePath } from '@/services/pathService';
 *   const result = await calculatePath('fw-milano', '8.8.8.8');
 */

import apiClient from '../api/client';
import { extractErrorMessage } from '../utils/errors';

/**
 * Calcola il percorso tra un nodo sorgente e un IP destinazione
 *
 * @param {string} source - Node key sorgente (es. "fw-milano" o "fw-milano:root")
 * @param {string} destination - IP destinazione (es. "8.8.8.8")
 * @param {number} maxTtl - Massimo numero di hop (default 64)
 * @returns {Promise<Object>} PathResult con hops, status e dettagli
 * @throws {Error} Se la richiesta fallisce
 *
 * Esempio risposta:
 * {
 *   source_node: { device_id: "fw-milano", vdom: "root" },
 *   target_ip: "8.8.8.8",
 *   hops: [
 *     {
 *       node: { device_id: "fw-milano", vdom: "root" },
 *       ingress_interface: null,
 *       egress_interface: "port1",
 *       matched_route_destination: "0.0.0.0/0",
 *       matched_route_gateway: "10.0.0.1",
 *       matched_route_protocol: "static",
 *       action: "exit_wan",
 *       next_hop_ip: "10.0.0.1"
 *     }
 *   ],
 *   status: "exit_wan",
 *   exit_point: "fw-milano:root",
 *   exit_interface: "port1",
 *   exit_gateway: "10.0.0.1"
 * }
 */
export const calculatePath = async (source, destination, maxTtl = 64, algorithm = 'dijkstra', excludeDefaultRoute = false) => {
  try {
    const response = await apiClient.post('/api/path', {
      source,
      destination,
      max_ttl: maxTtl,
      algorithm,  // 'dijkstra' uses topology links, 'lpm' uses routing tables
      exclude_default_route: excludeDefaultRoute,
    });
    return response.data;
  } catch (error) {
    console.error('[PathService] Failed to calculate path:', error);

    throw new Error(extractErrorMessage(error, 'Errore nel calcolo del percorso'));
  }
};

/**
 * Converte un PathResult in un formato comodo per la visualizzazione
 *
 * @param {Object} pathResult - PathResult dal backend
 * @returns {Object} Percorso formattato per React Flow
 *
 * Esempio output:
 * {
 *   nodeKeys: ["fw-milano:root", "fw-roma:root"],
 *   edgeKeys: ["fw-milano:root -> fw-roma:root"],
 *   status: "reached",
 *   summary: "Path found: 2 hops"
 * }
 */
export const formatPathForVisualization = (pathResult) => {
  if (!pathResult || !pathResult.hops) {
    return {
      nodeKeys: [],
      edgeKeys: [],
      status: 'error',
      summary: 'Invalid path result',
    };
  }

  const nodeKeys = [];
  const edgeKeys = [];

  // Estrai node keys dagli hop
  pathResult.hops.forEach((hop, index) => {
    const nodeKey = `${hop.node.device_id}:${hop.node.vdom}`;
    nodeKeys.push(nodeKey);

    // Crea edge key verso il next hop (se presente)
    if (hop.next_hop_ip && index < pathResult.hops.length - 1) {
      const nextHop = pathResult.hops[index + 1];
      const nextNodeKey = `${nextHop.node.device_id}:${nextHop.node.vdom}`;
      edgeKeys.push(`${nodeKey} -> ${nextNodeKey}`);
    }
  });

  // Summary message basato sullo status
  const statusMessages = {
    reached: `✅ Percorso trovato: ${nodeKeys.length} hop`,
    dropped: `❌ Pacchetto droppato`,
    loop: `⚠️ Loop di routing rilevato`,
    ttl_exceeded: `⏱️ TTL esaurito`,
    exit_wan: `🌐 Uscita verso WAN via ${pathResult.exit_gateway}`,
    no_neighbor: `🚫 Gateway non raggiungibile`,
  };

  return {
    nodeKeys,
    edgeKeys,
    status: pathResult.status,
    summary: statusMessages[pathResult.status] || 'Status sconosciuto',
    fullResult: pathResult,
  };
};

/**
 * Estrae la lista di nodi disponibili per il dropdown sorgente
 *
 * @param {Array} nodes - Lista di node_keys dalla topologia
 * @returns {Array} Lista formattata per dropdown
 *
 * Esempio output:
 * [
 *   { value: "fw-milano:root", label: "fw-milano (root)" },
 *   { value: "fw-roma:root", label: "fw-roma (root)" }
 * ]
 */
export const formatNodesForDropdown = (nodes) => {
  if (!Array.isArray(nodes)) {
    return [];
  }

  return nodes.map((nodeKey) => {
    const parts = nodeKey.split(':');
    const deviceId = parts[0];
    const vdom = parts[1] || 'root';

    return {
      value: nodeKey,
      label: `${deviceId} (${vdom})`,
    };
  });
};

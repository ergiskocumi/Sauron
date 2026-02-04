/**
 * INVENTORY TABLE - Feature Component
 *
 * Componente principale per visualizzare la lista dei firewall.
 * Gestisce automaticamente loading, errori e visualizzazione dati.
 *
 * Pattern Applicato:
 * - Container/Presentational: Logica separata dalla presentazione
 * - Custom Hook: useInventory gestisce lo stato
 * - Composition: Usa componenti UI primitivi riutilizzabili
 *
 * Uso:
 *   <InventoryTable />
 */

import { useInventory } from '../../hooks/useInventory';
import {
  Card,
  CardHeader,
  CardBody,
  CardTitle,
} from '../../components/ui/Card';
import {
  Table,
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  TableEmptyState,
} from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Alert } from '../../components/ui/Alert';

export const InventoryTable = () => {
  const { inventory, loading, error, refetch } = useInventory();

  /**
   * Stato: Loading
   */
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Inventario Firewall</CardTitle>
        </CardHeader>
        <CardBody>
          <LoadingSpinner message="Caricamento inventario..." />
        </CardBody>
      </Card>
    );
  }

  /**
   * Stato: Error
   */
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Inventario Firewall</CardTitle>
        </CardHeader>
        <CardBody>
          <Alert
            variant="error"
            title="Errore di Connessione"
            message={error}
          />
          <div className="mt-4 flex justify-center">
            <button
              onClick={refetch}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Riprova
            </button>
          </div>
        </CardBody>
      </Card>
    );
  }

  /**
   * Stato: Success (con dati)
   */
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div>
          <CardTitle>Inventario Firewall</CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            {inventory.length} firewall configurati
          </p>
        </div>
        <button
          onClick={refetch}
          className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Ricarica
        </button>
      </CardHeader>

      <CardBody className="p-0">
        {inventory.length === 0 ? (
          <TableEmptyState message="Nessun firewall configurato nell'inventario" />
        ) : (
          <Table>
            <TableHeader>
              <TableHeaderCell>Firewall ID</TableHeaderCell>
              <TableHeaderCell>Host</TableHeaderCell>
              <TableHeaderCell>VDOM Entry</TableHeaderCell>
              <TableHeaderCell>Stato</TableHeaderCell>
            </TableHeader>
            <TableBody>
              {inventory.map((firewall) => (
                <TableRow key={firewall.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                        />
                      </svg>
                      <span className="font-medium">{firewall.id}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {firewall.host}
                    </code>
                  </TableCell>
                  <TableCell>
                    <span className="text-gray-600">{firewall.entry_vdom}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={firewall.enabled ? 'success' : 'gray'}>
                      {firewall.enabled ? 'Abilitato' : 'Disabilitato'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
};

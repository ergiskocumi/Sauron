/**
 * SAURON FRONTEND - Main Application
 *
 * Entry point dell'applicazione React.
 * Gestisce il routing e il layout principale.
 */

import { Layout } from './components/Layout';
import { InventoryTable } from './features/inventory/InventoryTable';

function App() {
  return (
    <Layout>
      <div className="max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Dashboard Rete
          </h1>
          <p className="text-gray-600">
            Visualizza e gestisci l'infrastruttura di rete multi-firewall
          </p>
        </div>

        {/* Inventory Table */}
        <InventoryTable />

        {/* Future sections */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Scansione Rete
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Avvia una scansione della topologia di rete
            </p>
            <button
              disabled
              className="px-4 py-2 bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed"
            >
              Prossimamente
            </button>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Pathfinder
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Traccia il percorso di un pacchetto nella rete
            </p>
            <button
              disabled
              className="px-4 py-2 bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed"
            >
              Prossimamente
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default App;

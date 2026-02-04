/**
 * LAYOUT COMPONENT - Application Shell
 *
 * Layout principale dell'applicazione con Sidebar e area contenuti.
 */

export const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-gray-900 text-white shadow-lg">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <svg
              className="w-8 h-8 text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
              />
            </svg>
            <div>
              <h1 className="text-xl font-bold">Sauron</h1>
              <p className="text-xs text-gray-400">Network Discovery</p>
            </div>
          </div>

          <nav className="space-y-2">
            <NavItem
              icon={
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                  />
                </svg>
              }
              label="Inventario"
              active
            />
            <NavItem
              icon={
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                  />
                </svg>
              }
              label="Topologia"
              disabled
            />
            <NavItem
              icon={
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              }
              label="Pathfinder"
              disabled
            />
          </nav>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-gray-800">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span>Backend Online</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 p-8">{children}</main>
    </div>
  );
};

const NavItem = ({ icon, label, active, disabled }) => {
  const baseClasses =
    'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors';
  const activeClasses = active
    ? 'bg-blue-600 text-white'
    : disabled
    ? 'text-gray-500 cursor-not-allowed'
    : 'text-gray-300 hover:bg-gray-800 hover:text-white cursor-pointer';

  return (
    <div className={`${baseClasses} ${activeClasses}`}>
      <div className="w-5 h-5">{icon}</div>
      <span className="text-sm font-medium">{label}</span>
      {disabled && (
        <span className="ml-auto text-xs bg-gray-800 px-2 py-0.5 rounded">
          Presto
        </span>
      )}
    </div>
  );
};

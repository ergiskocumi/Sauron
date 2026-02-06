/**
 * TABLE COMPONENT - UI Primitive
 *
 * Componente tabella riutilizzabile con styling consistente.
 * Supporta header, body e gestione stati vuoti.
 */

export const Table = ({ children, className = '' }) => {
  return (
    <div className="overflow-x-auto">
      <table className={`min-w-full divide-y divide-slate-100 ${className}`}>
        {children}
      </table>
    </div>
  );
};

export const TableHeader = ({ children }) => {
  return (
    <thead className="bg-slate-50/50">
      <tr>{children}</tr>
    </thead>
  );
};

export const TableHeaderCell = ({ children, className = '' }) => {
  return (
    <th
      className={`px-8 py-5 text-left text-[11px] font-black text-blue-600 uppercase tracking-[0.2em] ${className}`}
    >
      {children}
    </th>
  );
};

export const TableBody = ({ children }) => {
  return <tbody className="bg-white divide-y divide-slate-50">{children}</tbody>;
};

export const TableRow = ({ children, className = '' }) => {
  return <tr className={`hover:bg-slate-50/80 transition-colors ${className}`}>{children}</tr>;
};

export const TableCell = ({ children, className = '' }) => {
  return (
    <td className={`px-8 py-5 whitespace-nowrap text-sm text-slate-600 font-medium ${className}`}>
      {children}
    </td>
  );
};

/**
 * Empty State per tabelle vuote
 */
export const TableEmptyState = ({ message = 'Nessun dato disponibile' }) => {
  return (
    <tbody>
      <tr>
        <td colSpan="100" className="px-6 py-12 text-center text-gray-500">
          <div className="flex flex-col items-center gap-2">
            <svg
              className="w-12 h-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <p className="text-sm">{message}</p>
          </div>
        </td>
      </tr>
    </tbody>
  );
};

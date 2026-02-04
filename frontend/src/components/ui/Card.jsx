/**
 * CARD COMPONENT - UI Primitive
 *
 * Componente base per contenitori di contenuto.
 * Fornisce padding, bordi e ombre consistenti.
 */

export const Card = ({ children, className = '' }) => {
  return (
    <div className={`bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden ${className}`}>
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className = '' }) => {
  return (
    <div className={`px-8 py-6 border-b border-slate-100 ${className}`}>
      {children}
    </div>
  );
};

export const CardBody = ({ children, className = '' }) => {
  return <div className={`px-8 py-6 ${className}`}>{children}</div>;
};

export const CardTitle = ({ children, className = '' }) => {
  return (
    <h3 className={`text-xl font-bold text-slate-800 tracking-tight ${className}`}>
      {children}
    </h3>
  );
};

/**
 * BADGE COMPONENT - UI Primitive
 *
 * Badge colorati per indicare stati (enabled/disabled, success/error, etc).
 */

import { cn } from '../../lib/utils';

const variants = {
  success: 'bg-green-500/10 text-green-600 border-green-200',
  error: 'bg-red-500/10 text-red-600 border-red-200',
  warning: 'bg-amber-500/10 text-amber-600 border-amber-200',
  info: 'bg-blue-500/10 text-blue-600 border-blue-200',
  gray: 'bg-slate-500/10 text-slate-600 border-slate-200',
};

export const Badge = ({ children, variant = 'gray', className = '' }) => {
  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
};

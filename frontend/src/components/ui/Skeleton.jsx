/**
 * SKELETON COMPONENT
 * 
 * Placeholder animato per stati di caricamento.
 * Alternativa visivamente più gradevole rispetto allo spinner.
 * Rispetta le preferenze di reduced motion.
 */

import { memo } from 'react';
import { cn } from '../../lib/utils';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const SkeletonBase = memo(({ className, children }) => {
  const shouldReduceMotion = useReducedMotion();
  
  return (
    <div 
      className={cn(
        "bg-slate-200 rounded-lg",
        !shouldReduceMotion && "animate-pulse",
        className
      )}
      aria-hidden="true"
    >
      {children}
    </div>
  );
});

SkeletonBase.displayName = 'SkeletonBase';

export const Skeleton = {
  Card: memo(({ className }) => (
    <div className={cn("bg-white rounded-3xl border border-slate-200 p-6 shadow-sm", className)}>
      <SkeletonBase className="h-8 w-1/3 mb-4" />
      <SkeletonBase className="h-4 w-1/2 mb-2" />
      <SkeletonBase className="h-4 w-2/3" />
    </div>
  )),
  
  TableRow: memo(({ columns = 4 }) => (
    <div className="flex items-center gap-4 py-4 px-6 border-b border-slate-100">
      <SkeletonBase className="w-12 h-12 rounded-2xl flex-shrink-0" />
      {Array.from({ length: columns - 1 }).map((_, i) => (
        <SkeletonBase key={i} className="h-4 flex-1" style={{ maxWidth: `${120 + (i * 40)}px` }} />
      ))}
    </div>
  )),
  
  StatusCard: memo(() => (
    <div className="px-6 py-5 rounded-3xl border bg-white flex items-center gap-5 shadow-sm">
      <SkeletonBase className="w-12 h-12 rounded-2xl" />
      <div className="flex-1">
        <SkeletonBase className="h-3 w-20 mb-2" />
        <SkeletonBase className="h-6 w-16" />
      </div>
    </div>
  )),
  
  Text: memo(({ lines = 1, className }) => (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBase 
          key={i} 
          className={cn(
            "h-4",
            i === lines - 1 && lines > 1 ? "w-2/3" : "w-full"
          )} 
        />
      ))}
    </div>
  )),
  
  Circle: memo(({ size = "md", className }) => {
    const sizes = { sm: "w-8 h-8", md: "w-12 h-12", lg: "w-16 h-16" };
    return <SkeletonBase className={cn(sizes[size], "rounded-full", className)} />;
  }),
  
  Base: SkeletonBase,
};

Skeleton.Card.displayName = 'SkeletonCard';
Skeleton.TableRow.displayName = 'SkeletonTableRow';
Skeleton.StatusCard.displayName = 'SkeletonStatusCard';
Skeleton.Text.displayName = 'SkeletonText';
Skeleton.Circle.displayName = 'SkeletonCircle';

export default Skeleton;

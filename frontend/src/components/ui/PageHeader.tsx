import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

/**
 * Page header matching Apple Music's large typographic scale:
 * "Listen Now", "Recently Added" etc. with an optional subtitle/actions row.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3"
    >
      <div className="min-w-0">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight sm:text-[32px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-secondary">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </motion.header>
  );
}

/** Section header used on Listen Now and other grid pages. */
export function SectionHeader({
  title,
  action,
  className = '',
}: {
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-3 mt-8 flex items-end justify-between gap-4 first:mt-0 ${className}`}>
      <h2 className="text-[19px] font-bold tracking-tight">{title}</h2>
      {action}
    </div>
  );
}
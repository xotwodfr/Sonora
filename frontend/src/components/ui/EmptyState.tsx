import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  message?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon = Sparkles, title, message, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center gap-3 px-8 py-24 text-center"
    >
      <div className="glass-control pointer-events-none h-16 w-16">
        <Icon className="h-7 w-7 text-secondary" strokeWidth={1.4} />
      </div>
      <h3 className="text-lg font-semibold text-default">{title}</h3>
      {message && <p className="max-w-sm text-sm leading-relaxed text-secondary">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </motion.div>
  );
}
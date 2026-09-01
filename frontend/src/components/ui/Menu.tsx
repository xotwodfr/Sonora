import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  danger?: boolean;
  onSelect?: () => void;
  items?: MenuItem[]; // submenu
}

interface MenuProps {
  trigger?: ReactNode;
  items: (MenuItem | 'divider')[];
  align?: 'start' | 'end';
  /** className for the trigger button */
  buttonClassName?: string;
  ariaLabel?: string;
}

/**
 * Glass dropdown menu — used by the "⋯" affordance on rows, headers, cards.
 * Closes on outside click, Escape, or selection; supports nested submenus.
 */
export function Menu({
  trigger,
  items,
  align = 'end',
  buttonClassName = '',
  ariaLabel = 'More actions',
}: MenuProps) {
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState<MenuItem | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setSubmenu(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  let submenuContent: ReactNode = null;
  if (submenu?.items) {
    submenuContent = (
      <motion.div
        key="submenu"
        initial={{ opacity: 0, x: 6 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 6 }}
        transition={{ duration: 0.12 }}
        className="glass-strong absolute left-full top-0 z-50 ml-1 min-w-44 rounded-xl border p-1.5 shadow-2xl"
        role="menu"
      >
        {submenu.items.map((item, i) => (
          <MenuItemRow
            key={`${item.label}-${i}`}
            item={item}
            onClick={() => {
              item.onSelect?.();
              close();
            }}
          />
        ))}
      </motion.div>
    );
  }

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`glass-control h-8 w-8 rounded-full ${buttonClassName}`}
      >
        {trigger ?? <MoreHorizontal className="h-4 w-4" />}
      </button>
      <AnimatePresence>
        {open && (
          <div
            className={`absolute z-50 mt-2 ${align === 'end' ? 'right-0' : 'left-0'}`}
            style={{ top: '100%' }}
          >
            <motion.div
              key="menu"
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -2 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
              role="menu"
              className="glass-strong z-50 min-w-48 overflow-hidden rounded-xl border p-1.5 shadow-2xl"
            >
              {items.length > 0 ? (
                items.map((item, i) =>
                  item === 'divider' ? (
                    <div key={`d-${i}`} className="mx-2 my-1 h-px bg-[var(--glass-border)]" role="separator" />
                  ) : (
                    <MenuItemRow
                      key={`${item.label}-${i}`}
                      item={item}
                      onHover={() => setSubmenu(item.items ? item : null)}
                      onClick={() => {
                        if (!item.items) {
                          item.onSelect?.();
                          close();
                        }
                      }}
                    />
                  ),
                )
              ) : (
                <div className="px-3 py-2 text-sm text-secondary">No actions</div>
              )}
            </motion.div>
            <AnimatePresence>{submenuContent}</AnimatePresence>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItemRow({
  item,
  onClick,
  onHover,
}: {
  item: MenuItem;
  onClick: () => void;
  onHover?: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      role="menuitem"
      onPointerEnter={onHover}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left text-sm transition-colors duration-100 ${
        item.danger ? 'text-red-400 hover:bg-red-500/10' : 'hover:bg-[var(--glass-fill-strong)]'
      }`}
    >
      <span className={`flex w-4 items-center justify-center ${item.danger ? 'text-red-400' : 'text-secondary'}`}>
        {Icon ? <Icon className="h-4 w-4" strokeWidth={1.8} /> : null}
      </span>
      <span className="flex-1 truncate">{item.label}</span>
      {item.items && <span className="text-[10px] text-tertiary">▸</span>}
    </button>
  );
}
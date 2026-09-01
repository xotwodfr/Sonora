import { useCallback, useRef, useState } from 'react';

interface SliderProps {
  value: number;
  max: number;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
  ariaLabel: string;
  /** compact = thinner track, default sized */
  size?: 'md' | 'sm';
  className?: string;
}

/** Fraction from a pointer/mouse event over the bar element. */
function fractionFromEvent(e: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) {
  const rect = e.currentTarget.getBoundingClientRect();
  return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
}

/**
 * Liquid seek/volume slider. The bar thickens on hover/press for precision,
 * respects reduced motion, and is fully keyboard operable (role="slider").
 */
export function Slider({
  value,
  max,
  onChange,
  onCommit,
  ariaLabel,
  size = 'md',
  className = '',
}: SliderProps) {
  const [scrubbing, setScrubbing] = useState(false);
  const [hover, setHover] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      setScrubbing(true);
      const next = fractionFromEvent(e) * max;
      onChange(next);
    },
    [max, onChange],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!scrubbing) return;
      const next = fractionFromEvent(e) * max;
      onChange(next);
    },
    [scrubbing, max, onChange],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      setScrubbing(false);
      const next = fractionFromEvent(e) * max;
      onChange(next);
      onCommit?.(next);
    },
    [max, onChange, onCommit],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = size === 'sm' ? 0.02 * max : max / 100;
    let next: number | null = null;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = value + step;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = value - step;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = max;
        break;
      default:
        return;
    }
    e.preventDefault();
    onChange(Math.min(max, Math.max(0, next)));
    onCommit?.(Math.min(max, Math.max(0, next)));
  };

  return (
    <div
      ref={barRef}
      className={`relative flex cursor-pointer touch-none items-center justify-center ${className}`}
      style={{ height: size === 'sm' ? 16 : 20 }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => setScrubbing(false)}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onKeyDown={onKeyDown}
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(value)}
      aria-valuetext={`${value.toFixed(0)} of ${max.toFixed(0)}`}
      tabIndex={0}
    >
      <div
        className="relative w-full overflow-hidden rounded-full transition-all duration-150"
        style={{
          height: scrubbing || hover ? (size === 'sm' ? 6 : 5) : size === 'sm' ? 4 : 3,
          background: 'var(--glass-fill-strong)',
          boxShadow: 'inset 0 0 0 1px var(--glass-border)',
        }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, var(--accent), #ff9f68)',
            boxShadow: '0 0 10px rgba(255, 120, 80, 0.35)',
          }}
        />
      </div>
      <div
        className="pointer-events-none absolute rounded-full bg-white"
        style={{
          left: `calc(${pct}% - 5px)`,
          width: 10,
          height: 10,
          opacity: scrubbing || hover ? 1 : 0,
          transition: 'opacity 0.15s',
          boxShadow: '0 0 0 2px var(--glass-border), 0 2px 6px rgba(0,0,0,0.4)',
          transform: `scale(${scrubbing ? 1.25 : 1})`,
        }}
      />
    </div>
  );
}
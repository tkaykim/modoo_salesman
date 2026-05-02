'use client';
// 44px height, hairline 0.5px bottom border, slot left/center/right (v2 패턴)

import type { ReactNode } from 'react';

export interface AppBarProps {
  title?: ReactNode;
  sub?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  transparent?: boolean;
  sticky?: boolean;
}

export function AppBar({ title, sub, left, right, transparent = false, sticky = true }: AppBarProps) {
  return (
    <header
      className={[
        'w-full flex items-center justify-between px-3',
        transparent ? 'bg-transparent' : 'bg-[var(--color-surface)]',
        !transparent && 'border-b border-[var(--color-hairline-soft)]',
        sticky && 'sticky top-0 z-30',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        minHeight: 44,
        paddingTop: 'max(env(safe-area-inset-top), 12px)',
      }}
    >
      <div className="min-w-[44px] flex items-center justify-start">{left}</div>
      <div className="flex-1 text-center px-2 min-w-0">
        {title && (
          <div className="text-[16px] font-semibold leading-tight text-[var(--color-ink)] truncate">
            {title}
          </div>
        )}
        {sub && <div className="text-[11px] text-[var(--color-muted)] mt-0.5 truncate">{sub}</div>}
      </div>
      <div className="min-w-[44px] flex items-center justify-end">{right}</div>
    </header>
  );
}

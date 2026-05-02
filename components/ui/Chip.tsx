'use client';
// 32px pill chip — active fill / inactive hairline border

import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  children: ReactNode;
}

export function Chip({ active = false, children, className = '', ...rest }: ChipProps) {
  const base = 'inline-flex items-center justify-center h-[32px] px-3 rounded-full text-[13px] font-semibold transition-colors whitespace-nowrap';
  const active_ = 'bg-[var(--color-brand-500)] text-white';
  const inactive_ = 'bg-white text-[var(--color-body)] border border-[var(--color-hairline)] active:bg-[var(--color-surface-alt)]';
  return (
    <button type="button" {...rest} className={`${base} ${active ? active_ : inactive_} ${className}`}>
      {children}
    </button>
  );
}

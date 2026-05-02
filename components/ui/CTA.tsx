'use client';
// 52px CTA — solid (brand fill) / ghost (border only) / soft (brand-100 bg)

import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface CTAProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'ghost' | 'soft' | 'dark';
  full?: boolean;
  size?: 'lg' | 'md' | 'sm';
  sub?: string;
  children: ReactNode;
}

export function CTA({
  variant = 'solid',
  full = true,
  size = 'lg',
  sub,
  children,
  className = '',
  ...rest
}: CTAProps) {
  const heightCls = size === 'lg' ? 'min-h-[52px]' : size === 'md' ? 'min-h-[44px]' : 'min-h-[36px]';
  const paddingCls = size === 'sm' ? 'px-3' : 'px-5';
  const radiusCls = 'rounded-[14px]';
  const baseCls = `${heightCls} ${paddingCls} ${radiusCls} font-bold text-[15px] inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-40 active:scale-[0.99]`;
  const widthCls = full ? 'w-full' : '';

  const variantCls = (() => {
    switch (variant) {
      case 'ghost':
        return 'bg-transparent text-[var(--color-brand-500)] border border-[var(--color-brand-500)] active:bg-[var(--color-brand-100)]';
      case 'soft':
        return 'bg-[var(--color-brand-100)] text-[var(--color-brand-800)] active:bg-[var(--color-brand-200)]';
      case 'dark':
        return 'bg-[var(--color-ink)] text-white active:opacity-90';
      case 'solid':
      default:
        return 'bg-[var(--color-brand-500)] text-white active:bg-[var(--color-brand-600)]';
    }
  })();

  const shadowStyle = variant === 'solid' ? { boxShadow: 'var(--shadow-cta)' } : undefined;

  return (
    <button
      type="button"
      {...rest}
      className={`${baseCls} ${widthCls} ${variantCls} ${className}`}
      style={{ ...shadowStyle, ...(rest.style ?? {}) }}
    >
      <span className="flex flex-col items-center leading-tight">
        <span>{children}</span>
        {sub && <span className="text-[11px] font-medium opacity-80 mt-0.5">{sub}</span>}
      </span>
    </button>
  );
}

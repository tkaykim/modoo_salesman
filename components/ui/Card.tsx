'use client';
// 카드 컨테이너 — surface bg + hairline border + radius 14

import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'elevated' | 'flat' | 'inverted';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ variant = 'default', padding = 'md', className = '', children, ...rest }: CardProps) {
  const paddingCls = padding === 'none' ? '' : padding === 'sm' ? 'p-3' : padding === 'lg' ? 'p-5' : 'p-4';
  const radiusCls = 'rounded-[14px]';

  const variantCls = (() => {
    switch (variant) {
      case 'elevated':
        return 'bg-white border border-[var(--color-hairline-soft)] shadow-[0_1px_2px_rgba(14,17,22,0.04)]';
      case 'flat':
        return 'bg-[var(--color-surface-alt)] border border-transparent';
      case 'inverted':
        return 'bg-[var(--color-ink)] text-white border border-transparent';
      case 'default':
      default:
        return 'bg-white border border-[var(--color-hairline)]';
    }
  })();

  return (
    <div {...rest} className={`${radiusCls} ${variantCls} ${paddingCls} ${className}`}>
      {children}
    </div>
  );
}

export function Section({
  title,
  action,
  children,
  className = '',
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`space-y-2 ${className}`}>
      {(title || action) && (
        <div className="flex items-end justify-between px-1">
          {title && <h3 className="text-[15px] font-bold text-[var(--color-ink)]">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function HairLine({ className = '' }: { className?: string }) {
  return <div className={`h-px bg-[var(--color-hairline)] ${className}`} />;
}

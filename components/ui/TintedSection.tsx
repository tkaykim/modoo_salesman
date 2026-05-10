'use client';

import type { ReactNode } from 'react';
import { Icon } from './Icon';

export type SectionTint = 'warning' | 'primary' | 'success' | 'gold';

const tints: Record<SectionTint, { bg: string; border: string }> = {
  warning: { bg: 'var(--color-warn-tint)', border: 'var(--color-warn-border)' },
  primary: { bg: 'var(--color-brand-softer)', border: 'var(--color-brand-100)' },
  success: { bg: '#eff8f3', border: '#cdebd9' },
  gold:    { bg: '#fff8e3', border: '#f4e2a8' },
};

export function TintedSection({
  title,
  right,
  onRight,
  alert,
  tint,
  children,
}: {
  title: string;
  right?: string;
  onRight?: () => void;
  alert?: boolean;
  tint?: SectionTint;
  children: ReactNode;
}) {
  const t = tint ? tints[tint] : null;
  return (
    <div className="mt-3.5 px-3">
      <div className="flex items-baseline justify-between px-1.5 pb-2">
        <div className="flex items-center gap-1.5">
          <h3 className="text-[13px] font-bold text-[var(--color-body)] tracking-tight">{title}</h3>
          {alert && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-err)]" />}
        </div>
        {right && (
          <button
            onClick={onRight}
            className="border-0 bg-transparent text-[var(--color-muted)] text-[12px] font-medium p-0 flex items-center gap-0.5"
          >
            {right}
            <Icon name="chevron-r" size={14} strokeWidth={2.2} color="var(--color-muted)" />
          </button>
        )}
      </div>
      <div
        className="rounded-[16px] overflow-hidden border"
        style={{
          background: t ? t.bg : '#fff',
          borderColor: t ? t.border : 'var(--color-hairline-soft)',
          boxShadow: 'var(--shadow-card-flat)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

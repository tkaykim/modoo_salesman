'use client';

import { Icon, type IconName } from './Icon';

export type QuickActionTint = 'primary' | 'purple' | 'success' | 'gold';

export interface QuickActionItem {
  icon: IconName;
  label: string;
  tint: QuickActionTint;
  badge?: number;
  onClick?: () => void;
}

const tints: Record<QuickActionTint, { bg: string; fg: string }> = {
  primary: { bg: 'var(--color-brand-100)', fg: 'var(--color-brand-500)' },
  purple:  { bg: 'var(--color-purple-soft)', fg: 'var(--color-purple)' },
  success: { bg: 'var(--color-pos-soft)', fg: 'var(--color-pos)' },
  gold:    { bg: 'var(--color-gold-soft)', fg: 'var(--color-gold-deep)' },
};

export function QuickActionGrid({ items }: { items: QuickActionItem[] }) {
  return (
    <div
      className="grid bg-white rounded-[16px] py-1.5"
      style={{
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        boxShadow: 'var(--shadow-card-flat)',
        border: '1px solid var(--color-hairline-soft)',
      }}
    >
      {items.map((it) => {
        const c = tints[it.tint];
        return (
          <button
            key={it.label}
            onClick={it.onClick}
            className="border-0 bg-transparent cursor-pointer flex flex-col items-center gap-2 py-3 relative active:opacity-70"
          >
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{ background: c.bg }}
            >
              <Icon name={it.icon} size={22} strokeWidth={1.8} color={c.fg} />
            </div>
            <div className="text-[12px] font-semibold tracking-tight" style={{ color: 'var(--color-body)' }}>
              {it.label}
            </div>
            {it.badge != null && it.badge > 0 && (
              <span
                className="absolute min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold leading-none text-white"
                style={{
                  top: 8,
                  right: 'calc(50% - 28px)',
                  background: 'var(--color-err-strong)',
                  border: '2px solid #fff',
                  padding: '0 5px',
                }}
              >
                {it.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

'use client';
// 하단 탭바 — glass blur 배경 + 4탭 레이아웃 (홈/단체/실적/더보기)

import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export interface TabItem<T extends string> {
  id: T;
  icon: IconName;
  label: string;
  badge?: number;
}

export interface TabBarProps<T extends string> {
  active: T;
  onChange: (id: T) => void;
  items: TabItem<T>[];
  primaryAction?: {
    icon: IconName;
    label: string;
    onClick: () => void;
  };
}

export function TabBar<T extends string>({ active, onChange, items, primaryAction }: TabBarProps<T>) {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 glass border-t border-[var(--color-hairline-soft)]"
      style={{
        paddingTop: 8,
        paddingBottom: 'max(env(safe-area-inset-bottom), 12px)',
      }}
    >
      <div className="max-w-md mx-auto flex items-end justify-around px-2 relative">
        {items.map((it) => {
          const isActive = it.id === active;
          return (
            <button
              key={it.id}
              onClick={() => onChange(it.id)}
              className="flex flex-col items-center gap-0.5 py-1 px-2 min-w-[56px] relative"
            >
              <Icon
                name={it.icon}
                size={22}
                strokeWidth={isActive ? 2 : 1.7}
                color={isActive ? 'var(--color-brand-500)' : 'var(--color-faint)'}
              />
              <span
                className={`text-[10px] leading-none ${isActive ? 'font-bold text-[var(--color-brand-500)]' : 'font-semibold text-[var(--color-faint)]'}`}
              >
                {it.label}
              </span>
              {it.badge && it.badge > 0 ? (
                <span className="absolute top-0 right-2 bg-[var(--color-err)] text-white text-[9px] font-bold rounded-full px-1.5 leading-tight">
                  {it.badge}
                </span>
              ) : null}
            </button>
          );
        })}

        {primaryAction && (
          <button
            onClick={primaryAction.onClick}
            className="flex flex-col items-center gap-0.5 py-1 min-w-[56px]"
          >
            <span
              className="w-[44px] h-[44px] rounded-[18px] bg-[var(--color-brand-500)] text-white flex items-center justify-center"
              style={{ boxShadow: 'var(--shadow-fab)' }}
            >
              <Icon name={primaryAction.icon} size={22} strokeWidth={2.2} color="white" />
            </span>
          </button>
        )}
      </div>
    </nav>
  );
}

export function NavSpacer({ children }: { children?: ReactNode }) {
  // bottom safe-area + tabbar height (≈68)
  return (
    <div style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 80px)' }}>{children}</div>
  );
}

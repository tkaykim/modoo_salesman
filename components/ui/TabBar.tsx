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

function TabButton<T extends string>({
  item,
  active,
  onChange,
}: {
  item: TabItem<T>;
  active: T;
  onChange: (id: T) => void;
}) {
  const isActive = item.id === active;
  return (
    <button
      onClick={() => onChange(item.id)}
      className="flex flex-col items-center gap-0.5 py-1 px-2 min-w-[56px] relative"
    >
      <Icon
        name={item.icon}
        size={22}
        strokeWidth={isActive ? 2 : 1.7}
        color={isActive ? 'var(--color-brand-500)' : 'var(--color-faint)'}
      />
      <span
        className={`text-[10px] leading-none ${
          isActive ? 'font-bold text-[var(--color-brand-500)]' : 'font-semibold text-[var(--color-faint)]'
        }`}
      >
        {item.label}
      </span>
      {item.badge && item.badge > 0 ? (
        <span className="absolute top-0 right-2 bg-[var(--color-err)] text-white text-[9px] font-bold rounded-full px-1.5 leading-tight">
          {item.badge}
        </span>
      ) : null}
    </button>
  );
}

export function TabBar<T extends string>({ active, onChange, items, primaryAction }: TabBarProps<T>) {
  // primaryAction이 있으면 items를 2분해 가운데 큰 버튼이 끼어들도록 (v2 패턴)
  const mid = primaryAction ? Math.floor(items.length / 2) : items.length;
  const left = primaryAction ? items.slice(0, mid) : items;
  const right = primaryAction ? items.slice(mid) : [];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 glass border-t border-[var(--color-hairline-soft)]"
      style={{
        paddingTop: 8,
        paddingBottom: 'max(env(safe-area-inset-bottom), 12px)',
      }}
    >
      <div className="max-w-md mx-auto flex items-end justify-around px-2 relative">
        {left.map((it) => (
          <TabButton key={it.id} item={it} active={active} onChange={onChange} />
        ))}

        {primaryAction && (
          <button
            onClick={primaryAction.onClick}
            className="flex flex-col items-center gap-1 min-w-[56px]"
            style={{ marginTop: -22 }}
            aria-label={primaryAction.label}
          >
            <span
              className="w-[52px] h-[52px] rounded-[18px] bg-[var(--color-brand-500)] text-white flex items-center justify-center"
              style={{
                boxShadow:
                  '0 8px 18px rgba(0,82,204,0.40), inset 0 2px 0 rgba(255,255,255,0.4)',
              }}
            >
              <Icon name={primaryAction.icon} size={24} strokeWidth={2.2} color="white" />
            </span>
            <span className="text-[10px] font-bold leading-none text-[var(--color-brand-500)]">
              {primaryAction.label}
            </span>
          </button>
        )}

        {right.map((it) => (
          <TabButton key={it.id} item={it} active={active} onChange={onChange} />
        ))}
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

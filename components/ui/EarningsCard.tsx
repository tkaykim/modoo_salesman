'use client';

import { Icon } from './Icon';

export interface EarningsCardProps {
  label: string;
  amount: number;
  goal?: number;
  yoyDelta?: number | null;
  stats?: { label: string; value: string | number; suffix?: string }[];
  onDetail?: () => void;
}

const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');

export function EarningsCard({ label, amount, goal, yoyDelta, stats, onDetail }: EarningsCardProps) {
  const goalPct = goal && goal > 0 ? Math.min(100, Math.round((amount / goal) * 100)) : null;
  return (
    <div className="px-3 pt-3">
      <div
        className="rounded-[18px] bg-white p-4"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[12px] text-[var(--color-muted)] font-semibold">{label}</div>
          {onDetail && (
            <button
              onClick={onDetail}
              className="border-0 bg-transparent text-[var(--color-muted)] text-[12px] font-medium p-0 flex items-center gap-0.5"
            >
              상세 <Icon name="chevron-r" size={14} strokeWidth={2.2} color="var(--color-muted)" />
            </button>
          )}
        </div>
        <div className="flex items-baseline gap-1.5">
          <div
            className="text-[30px] font-extrabold leading-none font-mono num"
            style={{ color: 'var(--color-ink)', letterSpacing: '-1px' }}
          >
            {fmt(amount)}
          </div>
          <div className="text-[15px] font-bold" style={{ color: 'var(--color-ink)' }}>
            원
          </div>
          <div className="flex-1" />
          {yoyDelta != null && (
            <div
              className="flex items-center gap-0.5 text-[12px] font-bold rounded-full px-2 py-1"
              style={{ background: 'var(--color-pos-soft)', color: 'var(--color-pos)' }}
            >
              <Icon name="arrow-up" size={12} strokeWidth={2.6} color="var(--color-pos)" />
              {yoyDelta}%
            </div>
          )}
        </div>
        {goalPct != null && (
          <div className="flex items-center gap-2.5 mt-3.5">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-hairline-soft)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${goalPct}%`, background: 'var(--color-brand-500)' }}
              />
            </div>
            <div className="text-[11px] font-semibold text-[var(--color-muted)]">
              목표{' '}
              <span className="text-[var(--color-brand-500)] font-extrabold font-mono num">{goalPct}%</span>
            </div>
          </div>
        )}
        {stats && stats.length > 0 && (
          <div
            className="grid mt-3.5 pt-3.5 border-t"
            style={{
              gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))`,
              borderColor: 'var(--color-hairline-soft)',
            }}
          >
            {stats.map((s, i) => (
              <div
                key={s.label}
                className={i > 0 ? 'pl-3 border-l' : ''}
                style={i > 0 ? { borderColor: 'var(--color-hairline-soft)' } : undefined}
              >
                <div className="text-[11px] text-[var(--color-muted)] font-medium mb-0.5">{s.label}</div>
                <div className="text-[18px] font-extrabold tracking-tight" style={{ color: 'var(--color-ink)' }}>
                  <span className="font-mono num">{s.value}</span>
                  {s.suffix && (
                    <span className="text-[12px] text-[var(--color-faint)] ml-0.5 font-semibold">{s.suffix}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

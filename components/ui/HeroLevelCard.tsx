'use client';

import { Icon } from './Icon';
import type { GradeInfo } from '@/lib/grades';

export interface HeroLevelCardProps {
  grade: GradeInfo;
  next: GradeInfo | null;
  thisMonthRevenue: number;
  baseDiscountPct?: number;
  couponCount: number;
  rank?: number | null;
  onClick?: () => void;
}

const fmt = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`;

export function HeroLevelCard({
  grade,
  next,
  thisMonthRevenue,
  baseDiscountPct,
  couponCount,
  rank,
  onClick,
}: HeroLevelCardProps) {
  const target = next ? next.monthlyThreshold : grade.monthlyThreshold;
  const base = grade.monthlyThreshold;
  const span = Math.max(1, target - base);
  const inLevel = Math.max(0, thisMonthRevenue - base);
  const pct = next ? Math.min(100, Math.round((inLevel / span) * 100)) : 100;
  const remaining = next ? Math.max(0, target - thisMonthRevenue) : 0;

  return (
    <div className="px-3">
      <button
        onClick={onClick}
        className="w-full text-left relative overflow-hidden rounded-[20px] p-5 text-white"
        style={{
          background: 'var(--color-brand-500)',
          boxShadow: 'var(--shadow-hero)',
        }}
      >
        {/* subtle ring ornament */}
        <span
          aria-hidden
          className="absolute pointer-events-none rounded-full"
          style={{
            right: -20,
            top: -20,
            width: 160,
            height: 160,
            border: '40px solid rgba(255,255,255,0.06)',
          }}
        />

        {/* Top row: LV badge / label / rank */}
        <div className="relative flex items-center gap-2">
          <span
            className="text-[11px] font-extrabold px-2 py-[3px] rounded-full"
            style={{ color: 'var(--color-brand-500)', background: '#fff', letterSpacing: 0.4 }}
          >
            {grade.shortLabel.toUpperCase()}
          </span>
          <span className="text-[14px] font-bold tracking-tight">{grade.label}</span>
          <span className="flex-1" />
          {rank != null && (
            <span className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.78)' }}>
              사내 {rank}위
            </span>
          )}
          <Icon name="chevron-r" size={16} strokeWidth={2} color="rgba(255,255,255,0.7)" />
        </div>

        {/* Progress bar */}
        <div className="relative mt-3.5">
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.22)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: '#fff' }}
            />
          </div>
        </div>
        <div className="relative flex justify-between mt-1.5 text-[11px]">
          <span style={{ color: 'rgba(255,255,255,0.78)' }}>
            {next ? (
              <>
                {next.label}까지 <b className="text-white font-mono num">{fmt(remaining)}</b>
              </>
            ) : (
              <span className="text-white font-bold">최고 등급 유지</span>
            )}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.6)' }} className="font-mono num">
            {pct}%
          </span>
        </div>

        {/* divider */}
        <div className="relative my-4 h-px" style={{ background: 'rgba(255,255,255,0.16)' }} />

        {/* perks row */}
        <div className="relative flex items-center justify-between">
          <Perk label="수수료" value={`${Math.round(grade.commissionRate * 100)}%`} />
          <span className="w-px h-[26px]" style={{ background: 'rgba(255,255,255,0.16)' }} />
          <Perk label="보유 쿠폰" value={`${couponCount}장`} />
          <span className="w-px h-[26px]" style={{ background: 'rgba(255,255,255,0.16)' }} />
          <Perk label="이번 달 매출" value={fmt(thisMonthRevenue)} accent compact />
        </div>
      </button>
    </div>
  );
}

function Perk({ label, value, accent, compact }: { label: string; value: string; accent?: boolean; compact?: boolean }) {
  return (
    <div className="flex-1 text-center">
      <div
        className="text-[10px] font-semibold tracking-wide"
        style={{ color: 'rgba(255,255,255,0.65)' }}
      >
        {label}
      </div>
      <div
        className={`mt-1 font-extrabold tracking-tight font-mono num ${compact ? 'text-[13px]' : 'text-[16px]'}`}
        style={{ color: accent ? '#ffd84a' : '#fff' }}
      >
        {value}
      </div>
    </div>
  );
}

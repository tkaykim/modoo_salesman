'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon, type IconName, TintedSection } from '@/components/ui';
import MyOrdersSheet from '@/components/MyOrdersSheet';
import { useSalesmanStore } from '@/store/useSalesmanStore';
import { ALL_GRADES, type GradeInfo } from '@/lib/grades';

export interface ProfileTabProps {
  grade: GradeInfo;
  thisMonthRevenue: number;
  totalRevenue: number;
  couponCount: number;
  onOpenAcademy: () => void;
}

export default function ProfileTab({ grade, thisMonthRevenue, totalRevenue, couponCount, onOpenAcademy }: ProfileTabProps) {
  const router = useRouter();
  const { logout, user } = useSalesmanStore();
  const [myOrdersOpen, setMyOrdersOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  // 업적 — 실데이터(누적/이번달 확정 매출, 등급, 쿠폰) 기반 개인 진척. 경쟁/타인 비교 없음.
  const achievements: { id: string; icon: IconName; label: string; unlocked: boolean }[] = [
    { id: 'first',   icon: 'trophy',    label: '첫 매출',     unlocked: totalRevenue > 0 },
    { id: 'm100',    icon: 'star-fill', label: '누적 100만',  unlocked: totalRevenue >= 1_000_000 },
    { id: 'm500',    icon: 'flame',     label: '누적 500만',  unlocked: totalRevenue >= 5_000_000 },
    { id: 'coupon',  icon: 'gift',      label: '쿠폰 보유',   unlocked: couponCount > 0 },
    { id: 'grade5',  icon: 'verified',  label: 'Lv.5 등급',   unlocked: grade.displayOrder >= 5 },
    { id: 'month1k', icon: 'target',    label: '월 1천만',    unlocked: thisMonthRevenue >= 10_000_000 },
  ];

  return (
    <div className="bg-[var(--color-surface-alt)] min-h-full pt-4 pb-8">
      {/* Profile header card */}
      <div className="px-3">
        <div
          className="bg-white rounded-[18px] p-5"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          <div className="flex items-center gap-3.5">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-white font-extrabold text-[22px]"
              style={{ background: 'var(--color-brand-500)' }}
            >
              {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-extrabold px-2 py-[2px] rounded-full"
                  style={{ background: 'var(--color-brand-100)', color: 'var(--color-brand-500)', letterSpacing: 0.4 }}
                >
                  {grade.shortLabel.toUpperCase()}
                </span>
                <span className="text-[14px] font-bold text-[var(--color-ink)] tracking-tight truncate">
                  {user?.name || user?.email || '영업사원'}
                </span>
              </div>
              <p className="text-[11px] text-[var(--color-muted)] mt-1 font-mono">
                {user?.salesman_code} · {grade.label}
              </p>
            </div>
          </div>
          <div
            className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t"
            style={{ borderColor: 'var(--color-hairline-soft)' }}
          >
            <Stat label="이번 달" value={`${Math.round(thisMonthRevenue / 10000).toLocaleString('ko-KR')}만원`} />
            <Stat label="누적" value={`${Math.round(totalRevenue / 10000).toLocaleString('ko-KR')}만원`} />
            <Stat label="수수료율" value={`${Math.round(grade.commissionRate * 100)}%`} />
          </div>
        </div>
      </div>

      {/* Level ladder */}
      <TintedSection title="레벨 사다리" right="LV.0 ~ LV.10" tint="primary">
        <div className="px-4 py-3.5 space-y-2">
          {ALL_GRADES.map((g) => {
            const reached = g.displayOrder <= grade.displayOrder;
            const isCurrent = g.level === grade.level;
            return (
              <div
                key={g.level}
                className="flex items-center gap-3 py-1.5"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-extrabold"
                  style={{
                    background: isCurrent
                      ? 'var(--color-brand-500)'
                      : reached
                        ? 'var(--color-brand-100)'
                        : 'var(--color-hairline-soft)',
                    color: isCurrent
                      ? '#fff'
                      : reached
                        ? 'var(--color-brand-500)'
                        : 'var(--color-faint)',
                  }}
                >
                  {g.shortLabel.replace('Lv.', '')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold tracking-tight" style={{ color: reached ? 'var(--color-ink)' : 'var(--color-faint)' }}>
                    {g.label}
                  </div>
                  <div className="text-[11px] text-[var(--color-muted)]">
                    수수료 {Math.round(g.commissionRate * 100)}% · 월 매출 {(g.monthlyThreshold / 10000).toLocaleString('ko-KR')}만원
                  </div>
                </div>
                {isCurrent && (
                  <span
                    className="text-[10px] font-extrabold px-2 py-[3px] rounded-full"
                    style={{ background: 'var(--color-brand-500)', color: '#fff' }}
                  >
                    현재
                  </span>
                )}
                {!reached && <Icon name="info" size={14} color="var(--color-faint)" />}
              </div>
            );
          })}
        </div>
      </TintedSection>

      {/* Coupons */}
      <TintedSection title="보유 쿠폰" right={`${couponCount}장`} tint="primary">
        {couponCount === 0 ? (
          <div className="px-4 py-6 text-center text-[12px] text-[var(--color-muted)]">
            현재 보유한 쿠폰이 없습니다.
          </div>
        ) : (
          <div className="px-4 py-3.5 flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-[12px] flex items-center justify-center"
              style={{ background: 'var(--color-gold-soft)' }}
            >
              <Icon name="tag" size={22} color="var(--color-gold-deep)" />
            </div>
            <div className="flex-1">
              <div className="text-[14px] font-bold text-[var(--color-ink)]">{couponCount}장 보유</div>
              <div className="text-[11px] text-[var(--color-muted)]">고객 영업 시 사용 가능</div>
            </div>
          </div>
        )}
      </TintedSection>

      {/* Achievements — 실데이터 기반 개인 진척 */}
      <TintedSection title="업적">
        <div className="grid grid-cols-3 gap-2 p-3">
          {achievements.map((a) => (
            <div key={a.id} className="text-center py-3">
              <div
                className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-1.5"
                style={{
                  background: a.unlocked ? 'var(--color-gold-soft)' : 'var(--color-hairline-soft)',
                }}
              >
                <Icon
                  name={a.icon}
                  size={22}
                  color={a.unlocked ? 'var(--color-gold-deep)' : 'var(--color-faint)'}
                />
              </div>
              <div className="text-[11px] font-bold tracking-tight" style={{ color: a.unlocked ? 'var(--color-ink)' : 'var(--color-faint)' }}>
                {a.label}
              </div>
            </div>
          ))}
        </div>
      </TintedSection>

      {/* Education entry */}
      <TintedSection title="교육 자료" right="파트너 스쿨">
        <div className="px-3 py-3">
          <button
            type="button"
            onClick={onOpenAcademy}
            className="w-full rounded-[14px] bg-white border border-[var(--color-hairline-soft)] p-3.5 text-left active:bg-[var(--color-surface-alt)]"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-[12px] flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--color-brand-100)' }}
              >
                <Icon name="trophy" size={20} color="var(--color-brand-500)" strokeWidth={2.2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-extrabold text-[var(--color-ink)] tracking-tight">
                  파트너 스쿨에서 이어보기
                </div>
                <div className="text-[11px] text-[var(--color-muted)] leading-relaxed mt-1">
                  교육 영상, 상담 스크립트, 실전 미션을 한곳에서 진행합니다.
                </div>
              </div>
              <Icon name="chevron-r" size={17} color="var(--color-faint)" />
            </div>
          </button>
        </div>
      </TintedSection>

      {/* FAQ — placeholder */}
      <TintedSection title="자주 묻는 질문">
        {FAQS.map((f, i) => (
          <button
            key={f.id}
            className="w-full px-4 py-3.5 flex items-center justify-between text-left active:bg-[var(--color-surface-alt)]"
            style={{ borderTop: i > 0 ? '1px solid var(--color-hairline-soft)' : 'none' }}
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <span
                className="text-[11px] font-extrabold rounded-full flex-shrink-0 px-1.5 py-[2px]"
                style={{ background: 'var(--color-brand-100)', color: 'var(--color-brand-500)' }}
              >
                Q
              </span>
              <span className="text-[13px] font-medium text-[var(--color-ink)] tracking-tight">{f.q}</span>
            </div>
            <Icon name="chevron-d" size={16} color="var(--color-faint)" />
          </button>
        ))}
      </TintedSection>

      {/* Settings */}
      <TintedSection title="설정">
        {([
          { icon: 'history', label: '내 주문 내역', onClick: () => setMyOrdersOpen(true) },
          { icon: 'send',    label: '본사 채널 문의', desc: '준비중', disabled: true },
          { icon: 'menu',    label: '알림 설정',     desc: '준비중', disabled: true },
        ] as const).map((m, i) => (
          <button
            key={m.label}
            onClick={'onClick' in m ? m.onClick : undefined}
            disabled={'disabled' in m ? m.disabled : false}
            className="w-full px-4 py-3.5 flex items-center gap-3 text-left active:bg-[var(--color-surface-alt)] disabled:opacity-50"
            style={{ borderTop: i > 0 ? '1px solid var(--color-hairline-soft)' : 'none' }}
          >
            <Icon name={m.icon} size={20} strokeWidth={1.7} color="var(--color-ink)" />
            <div className="flex-1 text-left">
              <div className="text-[13px] font-bold text-[var(--color-ink)]">{m.label}</div>
              {'desc' in m && m.desc && (
                <div className="text-[10px] text-[var(--color-faint)] mt-0.5">{m.desc}</div>
              )}
            </div>
            <Icon name="chevron-r" size={16} color="var(--color-faint)" />
          </button>
        ))}
      </TintedSection>

      <div className="px-3 mt-3.5">
        <button
          onClick={handleLogout}
          className="w-full bg-white border border-[var(--color-err)]/30 rounded-[14px] py-3.5 flex items-center justify-center gap-2 text-[var(--color-err)] font-bold active:bg-[var(--color-err)]/5"
        >
          <Icon name="logout" size={16} color="var(--color-err)" /> 로그아웃
        </button>
      </div>

      <p className="text-[10px] text-[var(--color-faint)] text-center pt-4">
        모두의 유니폼 영업사원 앱 v0.5
      </p>

      <MyOrdersSheet open={myOrdersOpen} onClose={() => setMyOrdersOpen(false)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-[10px] text-[var(--color-muted)] font-semibold mb-0.5">{label}</div>
      <div className="text-[14px] font-extrabold text-[var(--color-ink)] tracking-tight">{value}</div>
    </div>
  );
}

const FAQS = [
  { id: 'q1', q: '쿠폰은 어떤 단체에 사용할 수 있나요?' },
  { id: 'q2', q: '재주문 사이클 알림은 어떻게 계산되나요?' },
  { id: 'q3', q: '수수료 정산은 언제 들어오나요?' },
];

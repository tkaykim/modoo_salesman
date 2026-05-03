'use client';

// 새 주문 생성 진입점 — 빠른 견적 vs 디자인 포함 선택
// 디자인 포함은 modoo_app 디자이너로 이동 (영업사원 본인이 진행 → 본인 매출로 자동 귀속)

import { useState } from 'react';
import { Icon, Card, Section } from '@/components/ui';
import { useMyTeams } from '@/hooks/useMyTeams';
import type { Team } from '@/lib/teams';

const CUSTOMER_APP_BASE = (process.env.NEXT_PUBLIC_APP_BASE_URL || 'https://modoouniform.com').replace(/\/$/, '');

interface Props {
  open: boolean;
  onClose: () => void;
  /** 빠른 견적 모드로 진입 */
  onQuickQuote: (teamId: string | null) => void;
}

type Step = 'mode' | 'team_for_design';

export default function NewOrderChooser({ open, onClose, onQuickQuote }: Props) {
  const [step, setStep] = useState<Step>('mode');
  const { teams } = useMyTeams();
  const activeTeams = teams.filter((t) => t.isActive);

  const handleQuickQuote = () => {
    onQuickQuote(null);
    onClose();
    setStep('mode');
  };

  const handleDesignFlow = () => {
    setStep('team_for_design');
  };

  const handleTeamPicked = (team: Team) => {
    if (!team.isActive) {
      alert('이 단체는 아직 활성화되지 않았습니다. 본사에 활성화 요청을 해주세요.');
      return;
    }
    const slug = team.slug || team.shareToken;
    if (!slug) {
      alert('이 단체의 공유 링크가 발급되지 않았습니다.');
      return;
    }
    const url = `${CUSTOMER_APP_BASE}/mall/${slug}`;
    window.open(url, '_blank', 'noopener');
    onClose();
    setStep('mode');
  };

  const handleCatalog = () => {
    // 카탈로그 = 일반 제품 페이지. 영업사원이 본인 로그인 후 결제하면 본인 매출로 자동 귀속
    window.open(`${CUSTOMER_APP_BASE}/`, '_blank', 'noopener');
    onClose();
    setStep('mode');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/40">
      <div
        className="relative mt-auto bg-[var(--color-surface)] rounded-t-[20px] shadow-2xl flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', maxHeight: '80vh' }}
      >
        <header className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--color-hairline-soft)]">
          {step !== 'mode' ? (
            <button onClick={() => setStep('mode')} className="p-2 -ml-1 text-[var(--color-muted)]">
              <Icon name="arrow-l" size={20} />
            </button>
          ) : (
            <span className="w-10" />
          )}
          <h2 className="text-[15px] font-bold text-[var(--color-ink)] flex-1 text-center">
            {step === 'mode' && '새 주문 생성'}
            {step === 'team_for_design' && '단체 선택'}
          </h2>
          <button
            onClick={() => {
              onClose();
              setStep('mode');
            }}
            className="p-2 -mr-1 text-[var(--color-muted)]"
          >
            <Icon name="close" size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {step === 'mode' && (
            <>
              <p className="text-[12px] text-[var(--color-muted)] leading-relaxed">
                어떻게 시작하시겠어요?
              </p>

              {/* 디자인 포함 — 메인 옵션 */}
              <button
                onClick={handleDesignFlow}
                className="w-full bg-[var(--color-brand-500)] text-white rounded-[14px] p-4 flex items-start gap-3 active:bg-[var(--color-brand-600)] text-left"
                style={{ boxShadow: 'var(--shadow-cta)' }}
              >
                <span className="w-11 h-11 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Icon name="palette" size={22} color="white" strokeWidth={2} />
                </span>
                <span className="flex-1">
                  <span className="block font-bold text-[16px]">디자인 포함 주문</span>
                  <span className="block text-[12px] opacity-90 mt-0.5 leading-relaxed">
                    제품 → 디자이너 → 사이즈/수량 → 결제까지 풀 흐름.<br />
                    admin과 동일하게 작동합니다.
                  </span>
                </span>
                <Icon name="chevron-r" size={20} color="white" />
              </button>

              {/* 빠른 견적 */}
              <button
                onClick={handleQuickQuote}
                className="w-full bg-white border border-[var(--color-hairline)] rounded-[14px] p-4 flex items-start gap-3 active:bg-[var(--color-surface-alt)] text-left"
              >
                <span className="w-11 h-11 bg-[var(--color-brand-100)] rounded-full flex items-center justify-center flex-shrink-0">
                  <Icon name="ruler" size={22} color="var(--color-brand-500)" />
                </span>
                <span className="flex-1">
                  <span className="block font-bold text-[15px] text-[var(--color-ink)]">빠른 견적 (디자인 없이)</span>
                  <span className="block text-[11px] text-[var(--color-muted)] mt-0.5 leading-relaxed">
                    제품 SKU + 사이즈/수량 + 인쇄 옵션만으로<br />즉시 주문 등록. 디자인은 추후 보강.
                  </span>
                </span>
                <Icon name="chevron-r" size={18} color="var(--color-faint)" />
              </button>

              <p className="text-[10px] text-[var(--color-faint)] text-center pt-3 leading-relaxed">
                ⓘ 디자인 포함 흐름은 새 창으로 modoo_app으로 이동합니다.<br />
                본인 영업 코드는 자동 적용되어 매출이 본인에게 귀속됩니다.
              </p>
            </>
          )}

          {step === 'team_for_design' && (
            <>
              <p className="text-[12px] text-[var(--color-muted)] leading-relaxed">
                어떤 단체를 위한 주문인가요?
              </p>

              {activeTeams.length > 0 ? (
                <Section title={`활성 단체 (${activeTeams.length})`}>
                  <Card padding="none">
                    {activeTeams.map((t, i) => (
                      <button
                        key={t.id}
                        onClick={() => handleTeamPicked(t)}
                        className={`w-full px-4 py-3 flex items-center gap-3 active:bg-[var(--color-surface-alt)] text-left ${i > 0 ? 'border-t border-[var(--color-hairline-soft)]' : ''}`}
                      >
                        {t.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={t.logoUrl} alt={t.name} className="w-9 h-9 rounded-[8px] object-contain bg-[var(--color-surface-alt)] flex-shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-[8px] bg-[var(--color-brand-100)] flex items-center justify-center flex-shrink-0">
                            <Icon name="group" size={16} color="var(--color-brand-500)" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-[var(--color-ink)] truncate">{t.name}</p>
                          <p className="text-[10px] text-[var(--color-muted)]">
                            전용 mall 페이지로 이동
                          </p>
                        </div>
                        <Icon name="arrow-up-r" size={14} color="var(--color-faint)" />
                      </button>
                    ))}
                  </Card>
                </Section>
              ) : (
                <Card padding="md" variant="flat">
                  <p className="text-[12px] text-[var(--color-muted)] text-center leading-relaxed">
                    아직 활성화된 단체가 없습니다.<br />
                    단체를 등록하고 본사에 활성화를 요청하거나, 일반 카탈로그로 진입하세요.
                  </p>
                </Card>
              )}

              {/* 단체 미연결 = 일반 카탈로그 */}
              <Section title="단체 없이 진행">
                <button
                  onClick={handleCatalog}
                  className="w-full bg-white border border-[var(--color-hairline)] rounded-[14px] p-4 flex items-center gap-3 active:bg-[var(--color-surface-alt)] text-left"
                >
                  <span className="w-9 h-9 bg-[var(--color-surface-alt)] rounded-full flex items-center justify-center flex-shrink-0">
                    <Icon name="grid" size={18} color="var(--color-muted)" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-[13px] font-bold text-[var(--color-ink)]">일반 카탈로그로 이동</span>
                    <span className="block text-[10px] text-[var(--color-muted)] mt-0.5">제품 둘러보기 → 디자인 → 결제</span>
                  </span>
                  <Icon name="arrow-up-r" size={14} color="var(--color-faint)" />
                </button>
              </Section>

              <p className="text-[10px] text-[var(--color-faint)] text-center pt-2 leading-relaxed">
                ⓘ 새 창으로 열립니다. 본인이 로그인된 상태로 디자인 + 결제하면<br />
                매출이 본인에게 자동 귀속됩니다 (영업 코드 자동 적용).
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

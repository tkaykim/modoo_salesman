'use client';

// 새 주문 생성 진입점 — 풀 주문 (admin 흐름) vs 빠른 견적 선택

import { Icon } from '@/components/ui';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 풀 주문 생성 모달로 진입 (admin AdminOrderCreator 와 동일 흐름) */
  onFullOrder: () => void;
  /** 빠른 견적 모드 (CreateOrderSheet light) */
  onQuickQuote: () => void;
}

export default function NewOrderChooser({ open, onClose, onFullOrder, onQuickQuote }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/40">
      <div
        className="relative mt-auto bg-[var(--color-surface)] rounded-t-[20px] shadow-2xl flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <header className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--color-hairline-soft)]">
          <span className="w-10" />
          <h2 className="text-[15px] font-bold text-[var(--color-ink)] flex-1 text-center">새 주문 생성</h2>
          <button onClick={onClose} className="p-2 -mr-1 text-[var(--color-muted)]">
            <Icon name="close" size={20} />
          </button>
        </header>

        <div className="p-4 space-y-3">
          <p className="text-[12px] text-[var(--color-muted)] leading-relaxed">어떻게 시작하시겠어요?</p>

          {/* 풀 주문 (메인) */}
          <button
            onClick={() => {
              onFullOrder();
              onClose();
            }}
            className="w-full bg-[var(--color-brand-500)] text-white rounded-[14px] p-4 flex items-start gap-3 active:bg-[var(--color-brand-600)] text-left"
            style={{ boxShadow: 'var(--shadow-cta)' }}
          >
            <span className="w-11 h-11 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <Icon name="palette" size={22} color="white" strokeWidth={2} />
            </span>
            <span className="flex-1">
              <span className="block font-bold text-[16px]">풀 주문 생성</span>
              <span className="block text-[12px] opacity-90 mt-0.5 leading-relaxed">
                새 디자인 / 기존 디자인 / 상품 추가 — 다품목 가능.<br />
                결제 링크 발송, 계좌 이체, 결제 완료 처리 모두 지원.
              </span>
            </span>
            <Icon name="chevron-r" size={20} color="white" />
          </button>

          {/* 빠른 견적 */}
          <button
            onClick={() => {
              onQuickQuote();
              onClose();
            }}
            className="w-full bg-white border border-[var(--color-hairline)] rounded-[14px] p-4 flex items-start gap-3 active:bg-[var(--color-surface-alt)] text-left"
          >
            <span className="w-11 h-11 bg-[var(--color-brand-100)] rounded-full flex items-center justify-center flex-shrink-0">
              <Icon name="ruler" size={22} color="var(--color-brand-500)" />
            </span>
            <span className="flex-1">
              <span className="block font-bold text-[15px] text-[var(--color-ink)]">빠른 견적 (단순)</span>
              <span className="block text-[11px] text-[var(--color-muted)] mt-0.5 leading-relaxed">
                디자인 없이 SKU + 사이즈/수량 + 인쇄 옵션만으로<br />가벼운 견적이 필요할 때
              </span>
            </span>
            <Icon name="chevron-r" size={18} color="var(--color-faint)" />
          </button>

          <p className="text-[10px] text-[var(--color-faint)] text-center pt-3 leading-relaxed">
            ⓘ 본인 영업 할인코드는 자동으로 적용됩니다.<br />
            매출은 본인에게 자동 귀속되어 [실적] 탭에 집계됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}

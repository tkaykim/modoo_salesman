'use client';

import { Icon, type IconName } from '@/components/ui';

export interface ToolsTabProps {
  onOpenCalculator: () => void;
  onOpenCustomOrder: () => void;
  onOpenMyOrders: () => void;
}

interface ToolRow {
  icon: IconName;
  label: string;
  desc: string;
  onClick?: () => void;
  disabled?: boolean;
  badge?: string;
}

export default function ToolsTab({ onOpenCalculator, onOpenCustomOrder, onOpenMyOrders }: ToolsTabProps) {
  const primaryTools: ToolRow[] = [
    {
      icon: 'cart',
      label: '새 주문 생성',
      desc: '제품 · 디자인 · 사이즈별 수량',
      onClick: onOpenCustomOrder,
      badge: '추천',
    },
    {
      icon: 'ruler',
      label: '단가 계산기',
      desc: '디자인 없이 빠른 견적',
      onClick: onOpenCalculator,
    },
  ];

  const designTools: ToolRow[] = [
    {
      icon: 'palette',
      label: '디자인 템플릿',
      desc: '저장된 디자인 시안 불러오기',
      onClick: onOpenCustomOrder,
    },
    {
      icon: 'sparkle',
      label: '커스텀 디자인',
      desc: '직접 시안 만들어 주문 생성',
      onClick: onOpenCustomOrder,
    },
  ];

  const recordTools: ToolRow[] = [
    {
      icon: 'history',
      label: '내 주문 내역',
      desc: '본인이 만든 주문 / 단체 주문 전체',
      onClick: onOpenMyOrders,
    },
  ];

  return (
    <div className="bg-[var(--color-surface-alt)] min-h-full pt-4 pb-8">
      <div className="px-4 mb-4">
        <h2 className="text-[18px] font-extrabold text-[var(--color-ink)] tracking-tight">도구</h2>
        <p className="text-[12px] text-[var(--color-muted)] mt-1">영업에 필요한 모든 작업</p>
      </div>

      <ToolGroup title="주문" rows={primaryTools} />
      <ToolGroup title="디자인" rows={designTools} />
      <ToolGroup title="기록" rows={recordTools} />
    </div>
  );
}

function ToolGroup({ title, rows }: { title: string; rows: ToolRow[] }) {
  return (
    <div className="px-3 mb-3.5">
      <div className="px-1.5 pb-2">
        <h3 className="text-[13px] font-bold text-[var(--color-body)] tracking-tight">{title}</h3>
      </div>
      <div
        className="bg-white rounded-[16px] overflow-hidden"
        style={{ boxShadow: 'var(--shadow-card-flat)', border: '1px solid var(--color-hairline-soft)' }}
      >
        {rows.map((row, i) => (
          <button
            key={row.label}
            onClick={row.onClick}
            disabled={row.disabled}
            className="w-full flex items-center gap-3.5 px-4 py-4 text-left active:bg-[var(--color-surface-alt)] disabled:opacity-50"
            style={{
              borderTop: i > 0 ? '1px solid var(--color-hairline-soft)' : 'none',
            }}
          >
            <Icon name={row.icon} size={22} strokeWidth={1.7} color="var(--color-ink)" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-bold text-[var(--color-ink)] tracking-tight">{row.label}</span>
                {row.badge && (
                  <span
                    className="text-[10px] font-extrabold px-1.5 py-[2px] rounded-full"
                    style={{ background: 'var(--color-brand-100)', color: 'var(--color-brand-500)' }}
                  >
                    {row.badge}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[var(--color-muted)] mt-0.5">{row.desc}</div>
            </div>
            <Icon name="chevron-r" size={16} color="var(--color-faint)" />
          </button>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { Icon, Card, Chip, HairLine } from '@/components/ui';
import { useMyOrders, type MyOrderRow } from '@/hooks/useMyOrders';

const fmt = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`;

interface Props {
  open: boolean;
  onClose: () => void;
}

type Filter = 'all' | 'paid' | 'pending' | 'mine' | 'mall_only';

export default function MyOrdersSheet({ open, onClose }: Props) {
  const { orders, isLoading, error } = useMyOrders();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return orders
      .filter((o) => {
        if (filter === 'paid') return o.payment_status === 'completed' || o.payment_status === 'paid';
        if (filter === 'pending') return o.payment_status === 'pending';
        if (filter === 'mine') return !!o.salesman_id; // 본인에게 귀속된 매출
        if (filter === 'mall_only') return !o.salesman_id && !!o.partner_mall_id; // mall 경유 미귀속 (본사 직판)
        return true;
      })
      .filter((o) => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return (
          o.id.toLowerCase().includes(q) ||
          (o.customer_name ?? '').toLowerCase().includes(q) ||
          (o.partner_mall?.name ?? '').toLowerCase().includes(q)
        );
      });
  }, [orders, filter, search]);

  const counts = useMemo(
    () => ({
      all: orders.length,
      paid: orders.filter((o) => o.payment_status === 'completed' || o.payment_status === 'paid').length,
      pending: orders.filter((o) => o.payment_status === 'pending').length,
      mine: orders.filter((o) => !!o.salesman_id).length,
      mall_only: orders.filter((o) => !o.salesman_id && !!o.partner_mall_id).length,
    }),
    [orders]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-surface-alt)]">
      <div
        className="flex flex-col h-full"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <header
          className="bg-[var(--color-surface)] flex items-center justify-between px-3 py-2.5 border-b border-[var(--color-hairline-soft)]"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
        >
          <button onClick={onClose} className="p-2 -ml-1 text-[var(--color-muted)]" aria-label="닫기">
            <Icon name="arrow-l" size={20} />
          </button>
          <h2 className="text-[15px] font-bold text-[var(--color-ink)] flex-1 text-center">내 주문 내역</h2>
          <div className="w-10" />
        </header>

        {/* Search */}
        <div className="bg-[var(--color-surface)] px-4 py-2 border-b border-[var(--color-hairline-soft)]">
          <Card padding="sm" className="flex items-center gap-2">
            <Icon name="search" size={16} color="var(--color-faint)" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="주문번호 · 고객명 · 단체명 검색..."
              className="flex-1 outline-none text-[14px] bg-transparent"
            />
          </Card>
        </div>

        {/* Filter chips */}
        <div className="bg-[var(--color-surface)] px-3 py-2 flex gap-1.5 overflow-x-auto border-b border-[var(--color-hairline-soft)]">
          <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
            전체 {counts.all}
          </Chip>
          <Chip active={filter === 'paid'} onClick={() => setFilter('paid')}>
            결제 완료 {counts.paid}
          </Chip>
          <Chip active={filter === 'pending'} onClick={() => setFilter('pending')}>
            결제 대기 {counts.pending}
          </Chip>
          <Chip active={filter === 'mine'} onClick={() => setFilter('mine')}>
            내 매출 {counts.mine}
          </Chip>
          <Chip active={filter === 'mall_only'} onClick={() => setFilter('mall_only')}>
            본사 직판 {counts.mall_only}
          </Chip>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <div className="p-8 text-center text-[12px] text-[var(--color-muted)]">불러오는 중...</div>
          ) : error ? (
            <div className="p-6 text-[12px] text-[var(--color-err)] bg-[var(--color-err)]/10 rounded-[10px] border border-[var(--color-err)]/30">
              불러오기 실패: {error.message}
            </div>
          ) : filtered.length === 0 ? (
            <Card padding="lg">
              <div className="flex flex-col items-center text-center py-3">
                <div className="w-12 h-12 rounded-full bg-[var(--color-surface-alt)] flex items-center justify-center mb-3">
                  <Icon name="cart" size={22} color="var(--color-faint)" />
                </div>
                <p className="text-[13px] font-bold text-[var(--color-ink)] mb-1">주문이 없어요</p>
                <p className="text-[11px] text-[var(--color-muted)] leading-relaxed">
                  본인이 생성한 주문이나<br />
                  본인 단체의 주문이 여기에 표시됩니다.
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((o) => (
                <OrderCard key={o.id} order={o} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderCard({ order }: { order: MyOrderRow }) {
  const statusInfo = (() => {
    switch (order.payment_status) {
      case 'completed':
      case 'paid':
        return { label: '결제 완료', color: 'var(--color-pos)', bg: 'rgba(16,185,129,0.12)' };
      case 'pending':
        return { label: '결제 대기', color: 'var(--color-warn)', bg: 'rgba(245,158,11,0.12)' };
      case 'failed':
      case 'cancelled':
        return {
          label: order.payment_status === 'failed' ? '실패' : '취소',
          color: 'var(--color-err)',
          bg: 'rgba(239,68,68,0.12)',
        };
      default:
        return { label: order.payment_status ?? '미상', color: 'var(--color-muted)', bg: 'rgba(92,101,115,0.12)' };
    }
  })();

  const isMine = !!order.salesman_id;

  return (
    <Card padding="md">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            {isMine ? (
              <span className="text-[9px] font-bold bg-[var(--color-brand-100)] text-[var(--color-brand-700)] px-1.5 py-0.5 rounded">
                내 매출
              </span>
            ) : (
              <span className="text-[9px] font-bold bg-[var(--color-surface-alt)] text-[var(--color-muted)] px-1.5 py-0.5 rounded">
                본사 직판
              </span>
            )}
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ color: statusInfo.color, backgroundColor: statusInfo.bg }}
            >
              {statusInfo.label}
            </span>
          </div>
          <p className="text-[12px] font-mono text-[var(--color-muted)] num">{order.id}</p>
          <p className="text-[11px] text-[var(--color-faint)] mt-0.5">
            {new Date(order.created_at).toLocaleDateString('ko-KR')}
            {order.customer_name ? ` · ${order.customer_name}` : ''}
          </p>
          {order.partner_mall?.name && (
            <p className="text-[11px] text-[var(--color-brand-500)] font-semibold mt-0.5 flex items-center gap-1">
              <Icon name="group" size={11} color="var(--color-brand-500)" />
              {order.partner_mall.name}
            </p>
          )}
        </div>
      </div>
      <HairLine className="my-2" />
      <div className="flex justify-between items-center">
        <span className="text-[11px] text-[var(--color-muted)]">합계</span>
        <span className="text-[15px] font-bold text-[var(--color-ink)] font-mono num">
          {fmt(Number(order.total_amount) || 0)}
        </span>
      </div>
      {order.coupon_discount && Number(order.coupon_discount) > 0 ? (
        <div className="flex justify-between items-center mt-0.5">
          <span className="text-[10px] text-[var(--color-muted)]">쿠폰 할인</span>
          <span className="text-[11px] text-[var(--color-brand-500)] font-mono num">
            -{fmt(Number(order.coupon_discount))}
          </span>
        </div>
      ) : null}
    </Card>
  );
}

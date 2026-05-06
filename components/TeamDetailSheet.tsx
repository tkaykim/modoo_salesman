'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { useTeam } from '@/hooks/useTeam';
import { useTeamOrders, type TeamOrderRow } from '@/hooks/useTeamOrders';
import { useTeamAssets, type TeamAssetRow, type AssetType } from '@/hooks/useTeamAssets';
import { useTeamProducts, type TeamProductRow } from '@/hooks/useTeamProducts';
import AddTeamProductFlow from '@/components/AddTeamProductFlow';
import { useSalesmanStore } from '@/store/useSalesmanStore';
import { CATEGORY_COLORS, formatAddress, type Team } from '@/lib/teams';
import { Icon, Card, Section, HairLine, CTA, Chip } from '@/components/ui';

const fmt = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`;

interface Props {
  open: boolean;
  teamId: string | null;
  onClose: () => void;
  /**
   * 진열 기반 주문 생성 — 선택한 partner_mall_products로 V2를 prefill해 진입.
   * (단일이든 다중이든 동일한 콜백)
   */
  onCreateOrder: (teamId: string, selectedProducts?: TeamProductRow[]) => void;
  onEdit: (teamId: string) => void;
}

type DetailTab = 'overview' | 'products' | 'orders' | 'assets' | 'shareLink';

export default function TeamDetailSheet({ open, teamId, onClose, onCreateOrder, onEdit }: Props) {
  const [tab, setTab] = useState<DetailTab>('overview');

  const { team, isLoading, mutate: refetchTeam } = useTeam(open ? teamId : null);
  const { orders, totalRevenue, isLoading: ordersLoading } = useTeamOrders(open ? teamId : null);
  const { assets, logos, images, documents, isLoading: assetsLoading, mutate: refetchAssets } = useTeamAssets(open ? teamId : null);
  const { products, isLoading: productsLoading, mutate: refetchProducts } = useTeamProducts(open ? teamId : null);
  const [addProductOpen, setAddProductOpen] = useState(false);

  if (!open || !teamId) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/40">
      <div
        className="relative mt-auto bg-[var(--color-surface)] rounded-t-[20px] shadow-2xl h-[94vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--color-hairline-soft)]">
          <button onClick={onClose} className="p-2 -ml-1 text-[var(--color-muted)]" aria-label="닫기">
            <Icon name="close" size={20} />
          </button>
          <h2 className="text-[15px] font-bold text-[var(--color-ink)] flex-1 text-center truncate px-2">
            {team?.name || '단체 상세'}
          </h2>
          <button
            onClick={() => team && onEdit(team.id)}
            className="p-2 -mr-1 text-[var(--color-muted)]"
            aria-label="편집"
          >
            <Icon name="edit" size={18} />
          </button>
        </header>

        {/* Tabs */}
        <div className="px-3 py-2 border-b border-[var(--color-hairline-soft)] flex gap-1.5 overflow-x-auto">
          <Chip active={tab === 'overview'} onClick={() => setTab('overview')}>정보</Chip>
          <Chip active={tab === 'products'} onClick={() => setTab('products')}>
            제품 {products.length > 0 && `(${products.length})`}
          </Chip>
          <Chip active={tab === 'orders'} onClick={() => setTab('orders')}>
            주문 이력 {orders.length > 0 && `(${orders.length})`}
          </Chip>
          <Chip active={tab === 'assets'} onClick={() => setTab('assets')}>
            에셋 {assets.length > 0 && `(${assets.length})`}
          </Chip>
          <Chip active={tab === 'shareLink'} onClick={() => setTab('shareLink')}>공유 링크</Chip>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-10 text-center text-[12px] text-[var(--color-muted)]">불러오는 중...</div>
          ) : !team ? (
            <div className="p-10 text-center text-[13px] text-[var(--color-muted)]">단체 정보를 찾을 수 없습니다.</div>
          ) : (
            <>
              {tab === 'overview' && (
                <OverviewTab
                  team={team}
                  totalRevenue={totalRevenue}
                  ordersCount={orders.length}
                  logoCount={logos.length}
                  imageCount={images.length}
                  documentCount={documents.length}
                  products={products}
                  productsLoading={productsLoading}
                  onAddProduct={() => setAddProductOpen(true)}
                />
              )}
              {tab === 'products' && (
                <ProductsTab
                  products={products}
                  loading={productsLoading}
                  onAdd={() => setAddProductOpen(true)}
                  onOrderSingle={(p) => onCreateOrder(team.id, [p])}
                  onOrderMulti={(picked) => onCreateOrder(team.id, picked)}
                />
              )}
              {tab === 'orders' && <OrdersTab orders={orders} isLoading={ordersLoading} />}
              {tab === 'assets' && (
                <AssetsTab
                  teamId={team.id}
                  logos={logos}
                  images={images}
                  documents={documents}
                  isLoading={assetsLoading}
                  onMutate={async () => { await refetchAssets(); await refetchTeam(); }}
                />
              )}
              {tab === 'shareLink' && <ShareLinkTab team={team} />}
            </>
          )}
        </div>

        {/* Sticky bottom CTA */}
        {team && (
          <div className="border-t border-[var(--color-hairline-soft)] px-3 py-3 flex gap-2">
            {team.phone && (
              <a
                href={`tel:${team.phone.replace(/[^0-9+]/g, '')}`}
                className="flex-1 bg-[var(--color-pos)]/10 text-[var(--color-pos)] py-3 rounded-[14px] text-[13px] font-bold flex items-center justify-center gap-1 active:bg-[var(--color-pos)]/20"
              >
                <Icon name="phone" size={16} color="var(--color-pos)" /> 전화
              </a>
            )}
            <button
              onClick={() => onCreateOrder(team.id)}
              className="flex-[1.5] bg-[var(--color-brand-500)] text-white py-3 rounded-[14px] text-[13px] font-bold flex items-center justify-center gap-1 active:bg-[var(--color-brand-600)]"
              style={{ boxShadow: 'var(--shadow-cta)' }}
            >
              <Icon name="cart" size={16} color="white" /> 주문 생성
            </button>
          </div>
        )}
      </div>

      <AddTeamProductFlow
        open={addProductOpen}
        teamId={teamId}
        mallName={team?.name ?? null}
        onClose={() => setAddProductOpen(false)}
        onCreated={async () => {
          await refetchProducts();
          await refetchTeam();
        }}
      />
    </div>
  );
}

// =====================================================================
// 정보 탭
// =====================================================================
function OverviewTab({
  team,
  totalRevenue,
  ordersCount,
  logoCount,
  imageCount,
  documentCount,
  products,
  productsLoading,
  onAddProduct,
}: {
  team: Team;
  totalRevenue: number;
  ordersCount: number;
  logoCount: number;
  imageCount: number;
  documentCount: number;
  products: TeamProductRow[];
  productsLoading: boolean;
  onAddProduct: () => void;
}) {
  const addressLine = formatAddress(team.address);
  const cycleMonths = team.reorderCycleMonths;
  const lastOrderDays = team.lastOrderDays;

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Identity */}
      <Card padding="md">
        <div className="flex items-start gap-3">
          {team.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.logoUrl} alt={team.name} className="w-16 h-16 rounded-[12px] object-contain bg-[var(--color-surface-alt)] flex-shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-[12px] bg-[var(--color-brand-100)] flex items-center justify-center flex-shrink-0">
              <Icon name="group" size={28} color="var(--color-brand-500)" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              {team.category && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${CATEGORY_COLORS[team.category]}`}>
                  {team.category}
                </span>
              )}
              <StatusBadge status={team.status} />
              {!team.isActive && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-surface-alt)] text-[var(--color-muted)]">
                  비공개
                </span>
              )}
            </div>
            <h3 className="text-[16px] font-bold text-[var(--color-ink)] leading-tight">{team.name}</h3>
            <p className="text-[11px] text-[var(--color-muted)] mt-1">
              {team.size ? `${team.size}명` : '인원 미기재'}
              {cycleMonths ? ` · 재발주 ${cycleMonths}개월` : ''}
              {team.createdAt ? ` · 등록 ${new Date(team.createdAt).toLocaleDateString('ko-KR')}` : ''}
            </p>
          </div>
        </div>
      </Card>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="누적 주문" value={`${ordersCount}건`} />
        <StatCard label="누적 매출" value={fmt(totalRevenue)} accent="var(--color-brand-500)" />
        <StatCard
          label="마지막 주문"
          value={lastOrderDays !== null ? `${lastOrderDays}일 전` : '없음'}
          accent={team.status === 'reorder_due' ? 'var(--color-warn)' : undefined}
        />
      </div>

      {/* Address */}
      <Section title="주소">
        {addressLine ? (
          <Card padding="md">
            <div className="flex items-start gap-2">
              <Icon name="pin" size={16} color="var(--color-muted)" />
              <p className="text-[13px] text-[var(--color-body)] leading-relaxed flex-1">{addressLine}</p>
            </div>
          </Card>
        ) : (
          <EmptyMini text="주소가 등록되지 않았습니다" />
        )}
      </Section>

      {/* Contacts */}
      <Section title={`담당자 (${team.contacts.length})`}>
        {team.contacts.length === 0 ? (
          <EmptyMini text="담당자가 등록되지 않았습니다" />
        ) : (
          <Card padding="none">
            {team.contacts.map((c, i) => (
              <div
                key={i}
                className={`px-4 py-3 ${i > 0 ? 'border-t border-[var(--color-hairline-soft)]' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[14px] font-bold text-[var(--color-ink)]">{c.name}</span>
                      {c.role && (
                        <span className="text-[10px] text-[var(--color-muted)] bg-[var(--color-surface-alt)] px-1.5 py-0.5 rounded-full">
                          {c.role}
                        </span>
                      )}
                      {c.isPrimary && (
                        <span className="text-[9px] font-bold text-[var(--color-brand-500)]">★ 대표</span>
                      )}
                    </div>
                    {c.phone && <p className="text-[12px] text-[var(--color-muted)] font-mono">{c.phone}</p>}
                    {c.email && <p className="text-[11px] text-[var(--color-faint)]">{c.email}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {c.phone && (
                      <a
                        href={`tel:${c.phone.replace(/[^0-9+]/g, '')}`}
                        className="w-8 h-8 rounded-full bg-[var(--color-pos)]/10 flex items-center justify-center"
                      >
                        <Icon name="phone" size={14} color="var(--color-pos)" />
                      </a>
                    )}
                    {c.email && (
                      <a
                        href={`mailto:${c.email}`}
                        className="w-8 h-8 rounded-full bg-[var(--color-brand-100)] flex items-center justify-center"
                      >
                        <Icon name="send" size={14} color="var(--color-brand-500)" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </Card>
        )}
      </Section>

      {/* Note */}
      <Section title="메모">
        {team.note ? (
          <Card padding="md" className="bg-[#FFF8E1]" variant="flat">
            <p className="text-[13px] text-[var(--color-body)] leading-relaxed whitespace-pre-wrap">{team.note}</p>
          </Card>
        ) : (
          <EmptyMini text="메모 없음" />
        )}
      </Section>

      {/* Registered products preview */}
      <Section title={`등록된 제품 (${products.length})`}>
        {productsLoading ? (
          <EmptyMini text="불러오는 중..." />
        ) : products.length === 0 ? (
          <Card padding="md" variant="flat">
            <div className="flex flex-col items-center text-center gap-3 py-2">
              <p className="text-[12px] text-[var(--color-muted)] leading-relaxed">
                아직 등록된 제품이 없어요.<br />
                사장님께 보여드릴 첫 굿즈를 만들어볼까요?
              </p>
              <button
                onClick={onAddProduct}
                className="bg-[var(--color-brand-500)] text-white rounded-[12px] px-4 py-2 text-[12px] font-bold flex items-center gap-1 active:bg-[var(--color-brand-600)]"
              >
                <Icon name="plus" size={14} color="white" /> 첫 제품 만들기
              </button>
            </div>
          </Card>
        ) : (
          <div className="-mx-4 px-4 flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {products.slice(0, 12).map((p) => (
              <ProductMiniCard key={p.id} product={p} />
            ))}
            <button
              onClick={onAddProduct}
              className="w-[110px] flex-shrink-0 rounded-[12px] border-2 border-dashed border-[var(--color-hairline)] flex flex-col items-center justify-center gap-1 text-[var(--color-muted)] active:bg-[var(--color-surface-alt)]"
              style={{ aspectRatio: '110 / 158' }}
            >
              <Icon name="plus" size={20} color="var(--color-brand-500)" />
              <span className="text-[11px] font-bold text-[var(--color-ink)]">새 제품</span>
              <span className="text-[10px] text-[var(--color-muted)]">디자인하기</span>
            </button>
          </div>
        )}
      </Section>

      {/* Asset summary */}
      <Section title="에셋 요약">
        <Card padding="md">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <Icon name="image" size={20} color="var(--color-brand-500)" />
              <p className="text-[11px] text-[var(--color-muted)] mt-1">로고</p>
              <p className="text-[14px] font-bold text-[var(--color-ink)] num">{logoCount}</p>
            </div>
            <div>
              <Icon name="bg" size={20} color="var(--color-brand-500)" />
              <p className="text-[11px] text-[var(--color-muted)] mt-1">이미지</p>
              <p className="text-[14px] font-bold text-[var(--color-ink)] num">{imageCount}</p>
            </div>
            <div>
              <Icon name="card" size={20} color="var(--color-brand-500)" />
              <p className="text-[11px] text-[var(--color-muted)] mt-1">문서</p>
              <p className="text-[14px] font-bold text-[var(--color-ink)] num">{documentCount}</p>
            </div>
          </div>
        </Card>
      </Section>
    </div>
  );
}

// =====================================================================
// 제품 탭 — 진열대 (단일 클릭 = 즉시 1개 주문, 다중 선택 토글로 묶음 주문)
// =====================================================================
function ProductsTab({
  products,
  loading,
  onAdd,
  onOrderSingle,
  onOrderMulti,
}: {
  products: TeamProductRow[];
  loading: boolean;
  onAdd: () => void;
  onOrderSingle: (p: TeamProductRow) => void;
  onOrderMulti: (picked: TeamProductRow[]) => void;
}) {
  const [multi, setMulti] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const turnOnMulti = () => {
    setMulti(true);
    setSelectedIds(new Set());
  };
  const turnOffMulti = () => {
    setMulti(false);
    setSelectedIds(new Set());
  };

  const picked = products.filter((p) => selectedIds.has(p.id));
  const submitMulti = () => {
    if (picked.length === 0) return;
    onOrderMulti(picked);
  };

  if (loading) {
    return <div className="px-4 py-10 text-center text-[12px] text-[var(--color-muted)]">불러오는 중...</div>;
  }

  if (products.length === 0) {
    return (
      <div className="px-4 py-6">
        <Card padding="lg">
          <div className="flex flex-col items-center text-center py-3">
            <div className="w-12 h-12 rounded-full bg-[var(--color-surface-alt)] flex items-center justify-center mb-3">
              <Icon name="image" size={22} color="var(--color-faint)" />
            </div>
            <p className="text-[13px] font-bold text-[var(--color-ink)] mb-1">아직 등록된 제품이 없어요</p>
            <p className="text-[11px] text-[var(--color-muted)] mb-4 leading-relaxed">
              첫 디자인을 만들어 진열해보세요.<br />
              사장님이 mall URL에서 그대로 보고 주문할 수 있어요.
            </p>
            <button
              onClick={onAdd}
              className="bg-[var(--color-brand-500)] text-white font-bold py-2.5 px-5 rounded-[12px] text-[13px] inline-flex items-center gap-2 active:bg-[var(--color-brand-600)]"
            >
              <Icon name="plus" size={14} color="white" /> 새 제품 만들기
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-3 py-3 pb-32">
      {/* 상단 툴바 */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[11px] text-[var(--color-muted)]">
          {multi ? '여러 제품을 골라 한 번에 주문' : '카드를 누르면 바로 주문할 수 있어요'}
        </p>
        {multi ? (
          <button
            onClick={turnOffMulti}
            className="text-[12px] font-bold text-[var(--color-muted)] px-2 py-1"
          >
            취소
          </button>
        ) : (
          <button
            onClick={turnOnMulti}
            className="text-[12px] font-bold text-[var(--color-brand-500)] px-2 py-1"
          >
            여러 개 선택
          </button>
        )}
      </div>

      {/* 진열 그리드 */}
      <div className="grid grid-cols-2 gap-2.5">
        {products.map((p) => {
          const title = p.display_name || p.product?.title || '제품';
          const price = p.price ?? p.product?.base_price ?? null;
          const thumb = p.preview_url || p.product?.thumbnail_image_link?.[0];
          const isSelected = selectedIds.has(p.id);
          return (
            <button
              key={p.id}
              onClick={() => (multi ? toggle(p.id) : onOrderSingle(p))}
              className={`relative rounded-[14px] bg-[var(--color-surface)] ring-1 overflow-hidden text-left active:scale-[0.99] transition-transform ${
                isSelected
                  ? 'ring-2 ring-[var(--color-brand-500)]'
                  : 'ring-[var(--color-hairline-soft)]'
              }`}
            >
              {multi && (
                <span
                  className={`absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 ${
                    isSelected
                      ? 'bg-[var(--color-brand-500)] border-[var(--color-brand-500)] text-white'
                      : 'bg-white border-[var(--color-hairline)]'
                  }`}
                >
                  {isSelected && <Icon name="check" size={14} color="white" strokeWidth={3} />}
                </span>
              )}
              <div className="aspect-square bg-[var(--color-surface-alt)] relative">
                {thumb ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={thumb} alt={title} className="w-full h-full object-contain p-2" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Icon name="image" size={24} color="var(--color-faint)" />
                  </div>
                )}
                {p.color_hex && (
                  <span
                    className="absolute bottom-2 right-2 w-4 h-4 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: p.color_hex }}
                  />
                )}
              </div>
              <div className="px-2.5 py-2">
                <p className="text-[12px] font-bold text-[var(--color-ink)] line-clamp-2 leading-tight">
                  {title}
                </p>
                {price !== null && (
                  <p className="text-[11px] text-[var(--color-muted)] num mt-0.5">
                    ₩{Math.round(price).toLocaleString('ko-KR')}
                  </p>
                )}
              </div>
            </button>
          );
        })}

        <button
          onClick={onAdd}
          className="rounded-[14px] border-2 border-dashed border-[var(--color-hairline)] flex flex-col items-center justify-center gap-1 py-6 text-[var(--color-muted)] active:bg-[var(--color-surface-alt)]"
        >
          <Icon name="plus" size={22} color="var(--color-brand-500)" />
          <span className="text-[12px] font-bold text-[var(--color-ink)]">새 제품</span>
          <span className="text-[10px] text-[var(--color-muted)]">디자인 만들기</span>
        </button>
      </div>

      {/* 다중 선택 모드 하단 sticky CTA */}
      {multi && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-40 max-w-md w-[calc(100%-24px)]"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 88px)' }}
        >
          <button
            onClick={submitMulti}
            disabled={picked.length === 0}
            className="w-full rounded-[14px] bg-[var(--color-brand-500)] text-white py-3.5 text-[14px] font-bold flex items-center justify-center gap-2 active:bg-[var(--color-brand-600)] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ boxShadow: '0 8px 18px rgba(0,82,204,0.35)' }}
          >
            <Icon name="cart" size={16} color="white" />
            선택한 {picked.length}개로 주문
          </button>
        </div>
      )}
    </div>
  );
}

function ProductMiniCard({ product }: { product: TeamProductRow }) {
  const title = product.display_name || product.product?.title || '제품';
  const price = product.price ?? product.product?.base_price ?? null;
  const thumb = product.preview_url || product.product?.thumbnail_image_link?.[0];
  return (
    <div className="w-[110px] flex-shrink-0 rounded-[12px] bg-[var(--color-surface)] ring-1 ring-[var(--color-hairline-soft)] overflow-hidden">
      <div className="aspect-square bg-[var(--color-surface-alt)] relative">
        {thumb ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={thumb} alt={title} className="w-full h-full object-contain p-1.5" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon name="image" size={20} color="var(--color-faint)" />
          </div>
        )}
        {product.color_hex && (
          <span
            className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full border border-white"
            style={{ backgroundColor: product.color_hex }}
          />
        )}
      </div>
      <div className="px-2 py-1.5">
        <p className="text-[11px] font-bold text-[var(--color-ink)] truncate">{title}</p>
        {price !== null && (
          <p className="text-[10px] text-[var(--color-muted)] num">
            ₩{Math.round(price).toLocaleString('ko-KR')}
          </p>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Team['status'] }) {
  const map = {
    new: { label: '신규', cls: 'bg-[var(--color-brand-500)] text-white' },
    active: { label: '활성', cls: 'bg-[var(--color-pos)] text-white' },
    reorder_due: { label: '재발주 임박', cls: 'bg-[var(--color-warn)] text-white' },
    dormant: { label: '휴면', cls: 'bg-[var(--color-faint)] text-white' },
  } as const;
  const m = map[status];
  return <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${m.cls}`}>{m.label}</span>;
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-[var(--color-surface-alt)] rounded-[10px] px-2 py-2.5 text-center">
      <p className="text-[10px] text-[var(--color-muted)]">{label}</p>
      <p className="text-[13px] font-bold mt-0.5 num truncate" style={{ color: accent ?? 'var(--color-ink)' }}>
        {value}
      </p>
    </div>
  );
}

function EmptyMini({ text }: { text: string }) {
  return (
    <Card padding="md" variant="flat">
      <p className="text-[12px] text-[var(--color-muted)] text-center">{text}</p>
    </Card>
  );
}

// =====================================================================
// 주문 이력 탭
// =====================================================================
function OrdersTab({ orders, isLoading }: { orders: TeamOrderRow[]; isLoading: boolean }) {
  if (isLoading) {
    return <div className="p-8 text-center text-[12px] text-[var(--color-muted)]">불러오는 중...</div>;
  }
  if (orders.length === 0) {
    return (
      <div className="px-4 py-6">
        <Card padding="lg">
          <div className="flex flex-col items-center text-center py-3">
            <div className="w-12 h-12 rounded-full bg-[var(--color-surface-alt)] flex items-center justify-center mb-3">
              <Icon name="cart" size={22} color="var(--color-faint)" />
            </div>
            <p className="text-[13px] font-bold text-[var(--color-ink)] mb-1">주문 이력 없음</p>
            <p className="text-[11px] text-[var(--color-muted)]">
              이 단체에 묶인 주문이 아직 없습니다.<br />
              하단 [주문 생성]으로 첫 주문을 등록할 수 있습니다.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-2.5">
      {orders.map((o) => (
        <OrderRowCard key={o.id} order={o} />
      ))}
    </div>
  );
}

function OrderRowCard({ order }: { order: TeamOrderRow }) {
  const statusInfo = (() => {
    switch (order.payment_status) {
      case 'completed':
      case 'paid':
        return { label: '결제 완료', color: 'var(--color-pos)', bg: 'rgba(16,185,129,0.12)' };
      case 'pending':
        return { label: '결제 대기', color: 'var(--color-warn)', bg: 'rgba(245,158,11,0.12)' };
      case 'failed':
      case 'cancelled':
        return { label: order.payment_status === 'failed' ? '실패' : '취소', color: 'var(--color-err)', bg: 'rgba(239,68,68,0.12)' };
      default:
        return { label: order.payment_status ?? '미상', color: 'var(--color-muted)', bg: 'rgba(92,101,115,0.12)' };
    }
  })();

  return (
    <Card padding="md">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-mono text-[var(--color-muted)] num">{order.id}</p>
          <p className="text-[11px] text-[var(--color-faint)]">
            {new Date(order.created_at).toLocaleDateString('ko-KR')}
            {order.customer_name ? ` · ${order.customer_name}` : ''}
          </p>
        </div>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
          style={{ color: statusInfo.color, backgroundColor: statusInfo.bg }}
        >
          {statusInfo.label}
        </span>
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
          <span className="text-[11px] text-[var(--color-brand-500)] font-mono num">-{fmt(Number(order.coupon_discount))}</span>
        </div>
      ) : null}
      {order.notes && (
        <p className="text-[10px] text-[var(--color-faint)] mt-2 leading-relaxed line-clamp-2">{order.notes}</p>
      )}
    </Card>
  );
}

// =====================================================================
// 에셋 탭
// =====================================================================
function AssetsTab({
  teamId,
  logos,
  images,
  documents,
  isLoading,
  onMutate,
}: {
  teamId: string;
  logos: TeamAssetRow[];
  images: TeamAssetRow[];
  documents: TeamAssetRow[];
  isLoading: boolean;
  onMutate: () => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadType, setUploadType] = useState<AssetType>('logo');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { user } = useSalesmanStore();

  const onPickFile = (type: AssetType) => {
    setUploadType(type);
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop() || 'bin';
      const path = `${teamId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('partner-mall-assets')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('partner-mall-assets').getPublicUrl(path);

      const { error: insErr } = await supabase.from('partner_mall_assets').insert({
        partner_mall_id: teamId,
        asset_type: uploadType,
        url: pub.publicUrl,
        name: file.name,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: user?.salesman_profile_id ?? null,
      });
      if (insErr) throw insErr;

      // 로고 첫 업로드면 partner_malls.logo_url 도 자동 세팅 (편의)
      if (uploadType === 'logo' && logos.length === 0) {
        await supabase.from('partner_malls').update({ logo_url: pub.publicUrl }).eq('id', teamId);
      }

      await onMutate();
    } catch (err) {
      console.error('[TeamDetail] asset upload error:', err);
      setUploadError((err as Error).message ?? '업로드 실패');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAsset = async (asset: TeamAssetRow) => {
    if (!confirm(`'${asset.name ?? '에셋'}' 을 삭제할까요?`)) return;
    try {
      const supabase = createClient();
      // url에서 path 추출
      const marker = '/partner-mall-assets/';
      const idx = asset.url.indexOf(marker);
      if (idx >= 0) {
        const path = decodeURIComponent(asset.url.slice(idx + marker.length).split('?')[0]);
        await supabase.storage.from('partner-mall-assets').remove([path]);
      }
      await supabase.from('partner_mall_assets').delete().eq('id', asset.id);
      await onMutate();
    } catch (err) {
      console.error('[TeamDetail] asset delete error:', err);
      alert('삭제 실패: ' + (err as Error).message);
    }
  };

  const setPrimary = async (asset: TeamAssetRow) => {
    try {
      const supabase = createClient();
      // 같은 type 내 다른 primary 해제
      await supabase
        .from('partner_mall_assets')
        .update({ is_primary: false })
        .eq('partner_mall_id', teamId)
        .eq('asset_type', asset.asset_type);
      await supabase
        .from('partner_mall_assets')
        .update({ is_primary: true })
        .eq('id', asset.id);
      // 로고면 partner_malls.logo_url 동기화
      if (asset.asset_type === 'logo') {
        await supabase.from('partner_malls').update({ logo_url: asset.url }).eq('id', teamId);
      }
      await onMutate();
    } catch (err) {
      alert('대표 설정 실패: ' + (err as Error).message);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-[12px] text-[var(--color-muted)]">불러오는 중...</div>;
  }

  return (
    <div className="px-4 py-3 space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={onFileSelected}
      />

      {uploadError && (
        <div className="rounded-[10px] bg-[var(--color-err)]/10 border border-[var(--color-err)]/30 px-3 py-2 text-[12px] text-[var(--color-err)]">
          {uploadError}
        </div>
      )}

      <Section
        title={`로고 (${logos.length})`}
        action={
          <button
            disabled={uploading}
            onClick={() => onPickFile('logo')}
            className="text-[12px] text-[var(--color-brand-500)] font-bold flex items-center gap-1 disabled:opacity-50"
          >
            <Icon name="plus" size={14} color="var(--color-brand-500)" /> 업로드
          </button>
        }
      >
        {logos.length === 0 ? (
          <EmptyMini text="등록된 로고가 없습니다" />
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {logos.map((a) => (
              <AssetThumb key={a.id} asset={a} onRemove={() => removeAsset(a)} onSetPrimary={() => setPrimary(a)} />
            ))}
          </div>
        )}
      </Section>

      <Section
        title={`이미지 (${images.length})`}
        action={
          <button
            disabled={uploading}
            onClick={() => onPickFile('image')}
            className="text-[12px] text-[var(--color-brand-500)] font-bold flex items-center gap-1 disabled:opacity-50"
          >
            <Icon name="plus" size={14} color="var(--color-brand-500)" /> 업로드
          </button>
        }
      >
        {images.length === 0 ? (
          <EmptyMini text="등록된 이미지가 없습니다" />
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {images.map((a) => (
              <AssetThumb key={a.id} asset={a} onRemove={() => removeAsset(a)} />
            ))}
          </div>
        )}
      </Section>

      <Section
        title={`문서 (${documents.length})`}
        action={
          <button
            disabled={uploading}
            onClick={() => onPickFile('document')}
            className="text-[12px] text-[var(--color-brand-500)] font-bold flex items-center gap-1 disabled:opacity-50"
          >
            <Icon name="plus" size={14} color="var(--color-brand-500)" /> 업로드
          </button>
        }
      >
        {documents.length === 0 ? (
          <EmptyMini text="등록된 문서가 없습니다" />
        ) : (
          <div className="space-y-1.5">
            {documents.map((a) => (
              <Card key={a.id} padding="sm" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-[var(--color-surface-alt)] flex items-center justify-center">
                  <Icon name="card" size={16} color="var(--color-muted)" />
                </div>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-[12px] font-semibold text-[var(--color-body)] truncate"
                >
                  {a.name ?? '문서'}
                </a>
                <button onClick={() => removeAsset(a)} className="p-1 text-[var(--color-err)]">
                  <Icon name="trash" size={14} />
                </button>
              </Card>
            ))}
          </div>
        )}
      </Section>

      {uploading && (
        <div className="text-center text-[12px] text-[var(--color-brand-500)] font-bold animate-pulse">
          업로드 중...
        </div>
      )}

      <p className="text-[10px] text-[var(--color-faint)] text-center pt-2 leading-relaxed">
        ⓘ 로고는 디자인 시안·견적서·mall 페이지에 사용됩니다.<br />
        파일당 최대 10MB · PNG, JPG, SVG, PDF 지원
      </p>
    </div>
  );
}

function AssetThumb({
  asset,
  onRemove,
  onSetPrimary,
}: {
  asset: TeamAssetRow;
  onRemove: () => void;
  onSetPrimary?: () => void;
}) {
  const isImage = asset.mime_type?.startsWith('image/') ?? false;
  return (
    <div className="relative aspect-square rounded-[10px] overflow-hidden bg-[var(--color-surface-alt)] group border border-[var(--color-hairline)]">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={asset.url} alt={asset.name ?? ''} className="w-full h-full object-contain p-1" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Icon name="card" size={24} color="var(--color-muted)" />
        </div>
      )}
      {asset.is_primary && (
        <span className="absolute top-1 left-1 text-[8px] font-bold bg-[var(--color-brand-500)] text-white px-1 py-0.5 rounded">
          대표
        </span>
      )}
      <div className="absolute bottom-0 inset-x-0 flex">
        {onSetPrimary && !asset.is_primary && (
          <button onClick={onSetPrimary} className="flex-1 bg-black/50 text-white text-[9px] py-1">대표</button>
        )}
        <button onClick={onRemove} className="flex-1 bg-black/50 text-white text-[9px] py-1">삭제</button>
      </div>
    </div>
  );
}

// =====================================================================
// 공유 링크 탭
// =====================================================================
function ShareLinkTab({ team }: { team: Team }) {
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  // 고객용 modoo_app 도메인 (production 고정)
  const customerAppBase = 'https://modoouniform.com';
  const slug = team.slug || team.shareToken;
  const link = slug ? `${customerAppBase}/mall/${slug}` : null;
  const qrSrc = link
    ? `https://quickchart.io/qr?size=240&margin=2&text=${encodeURIComponent(link)}`
    : null;

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // noop
    }
  };

  const systemShare = async () => {
    if (!link) return;
    setShareError(null);
    const shareData = {
      title: `${team.name} 유니폼 컬렉션`,
      text: `${team.name} 전용 mall 페이지에서 바로 주문하세요.`,
      url: link,
    };
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share(shareData);
      } else {
        await copyLink();
      }
    } catch (err) {
      const isAbort =
        err instanceof DOMException && err.name === 'AbortError';
      if (!isAbort) {
        setShareError('공유에 실패했어요. 링크를 복사해 보세요.');
      }
    }
  };

  const kakaoShare = () => {
    if (!link) return;
    const text = `${team.name} 유니폼 컬렉션\n${link}`;
    // 카카오 SDK가 없는 환경 — 텍스트 공유 URL로 폴백
    const url = `https://accounts.kakao.com/weblogin/find_account?continue=${encodeURIComponent(
      `https://story.kakao.com/share?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`,
    )}`;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="px-4 py-4 space-y-4">
      <Card padding="md">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[var(--color-brand-100)] flex items-center justify-center flex-shrink-0">
            <Icon name="share" size={20} color="var(--color-brand-500)" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-[var(--color-ink)]">단체 전용 mall 페이지</p>
            <p className="text-[11px] text-[var(--color-muted)] mt-0.5">
              담당자에게 이 링크를 공유하면 등록된 제품을 직접 결제할 수 있습니다.
            </p>
          </div>
        </div>
      </Card>

      {link ? (
        <>
          {qrSrc && (
            <Card padding="md">
              <div className="flex flex-col items-center gap-3">
                <p className="text-[11px] font-bold text-[var(--color-muted)]">QR 코드</p>
                <div className="rounded-[16px] bg-white p-2.5 ring-1 ring-[var(--color-hairline-soft)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrSrc}
                    alt={`${team.name} QR`}
                    width={200}
                    height={200}
                    className="block"
                  />
                </div>
                <p className="text-[11px] text-[var(--color-faint)] text-center leading-relaxed">
                  사장님 휴대폰으로 스캔만 하면 바로 mall 페이지로 이동합니다.
                </p>
              </div>
            </Card>
          )}

          <Card padding="md">
            <p className="text-[10px] text-[var(--color-muted)] mb-1">공유 URL</p>
            <p className="text-[12px] font-mono text-[var(--color-ink)] break-all leading-relaxed">{link}</p>
          </Card>

          <div className="grid grid-cols-2 gap-2">
            <CTA onClick={copyLink} variant={copied ? 'soft' : 'solid'}>
              {copied ? (
                <>
                  <Icon name="check" size={16} color="var(--color-brand-700)" /> 복사됨
                </>
              ) : (
                <>
                  <Icon name="share" size={16} color="white" /> 링크 복사
                </>
              )}
            </CTA>
            <CTA onClick={systemShare} variant="soft">
              <Icon name="share" size={16} color="var(--color-brand-700)" /> 시스템 공유
            </CTA>
          </div>

          <button
            type="button"
            onClick={kakaoShare}
            className="w-full rounded-[14px] bg-[#FEE500] py-3 text-[13px] font-bold text-[#191600] active:opacity-90 flex items-center justify-center gap-1.5"
          >
            <span aria-hidden>💬</span>
            카카오톡으로 보내기
          </button>

          {shareError && (
            <p className="text-[11px] text-[var(--color-warn)] text-center">{shareError}</p>
          )}

          <p className="text-[10px] text-[var(--color-faint)] text-center leading-relaxed">
            ⓘ 담당자가 결제 시 본인의 영업 할인코드(쿠폰)가 자동 적용되어<br />
            매출이 본인에게 자동 귀속됩니다.
          </p>
        </>
      ) : (
        <Card padding="lg" variant="flat">
          <div className="text-center py-2">
            <Icon name="info" size={20} color="var(--color-muted)" />
            <p className="text-[11px] text-[var(--color-muted)] mt-2 leading-relaxed">
              공유 링크를 생성하는 중입니다…
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

// 고객 결제 링크 유틸 — 영업사원이 미결제 주문의 결제 URL을 다시 발송할 수 있도록.
// 토큰 발급/주문 생성은 /api/salesman/orders 에서 이뤄지고, 여기서는 표시·공유만 담당한다.

// 고객용 modoo_app 도메인 (production 고정). route.ts 의 링크 생성과 동일 패턴.
const CUSTOMER_APP_BASE = 'https://modoouniform.com';

export function buildPaymentLinkUrl(token: string | null | undefined): string | null {
  if (!token) return null;
  return `${CUSTOMER_APP_BASE}/order/custom/${token}`;
}

/**
 * 결제 링크 만료까지 남은 일수. 없거나 만료된 경우를 구분해 반환.
 * expired=true 면 이미 지난 것.
 */
export function paymentLinkExpiry(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): { hasExpiry: boolean; expired: boolean; daysLeft: number | null } {
  if (!expiresAt) return { hasExpiry: false, expired: false, daysLeft: null };
  const ms = new Date(expiresAt).getTime() - now.getTime();
  const daysLeft = Math.ceil(ms / (1000 * 60 * 60 * 24));
  return { hasExpiry: true, expired: ms <= 0, daysLeft };
}

/**
 * 카카오톡 등으로 보낼 결제 안내 문구.
 */
export function paymentLinkMessage(opts: {
  orderId: string;
  url: string;
  customerName?: string | null;
  amount?: number | null;
}): string {
  const hi = opts.customerName ? `${opts.customerName}님, ` : '';
  const amt = opts.amount != null ? `\n결제 금액: ₩${Math.round(opts.amount).toLocaleString('ko-KR')}` : '';
  return `${hi}주문(${opts.orderId}) 결제 링크입니다.${amt}\n아래 링크에서 결제해 주세요.\n${opts.url}`;
}

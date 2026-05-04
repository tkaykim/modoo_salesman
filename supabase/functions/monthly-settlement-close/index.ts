// Edge Function: 매월 정산 마감 (이전 달 매출 → settlements row 생성)
// 권장 cron: 매월 1일 새벽 (KST 04:00 = UTC 19:00 of previous day)
//   → cron 표현식: "0 19 L * *" 또는 supabase scheduled invoker 사용
// 멱등성: ON CONFLICT (salesman_id, settlement_period) DO NOTHING

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

interface OrderRow { total_amount: number | null; created_at: string }
interface SalesmanRow { id: string; grade: string | null; status: string | null }
interface GradeRow { level: string; commission_rate: number }

function getPreviousPeriod(now: Date): { period: string; start: string; end: string } {
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const period = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`;
  return {
    period,
    start: prev.toISOString(),
    end: next.toISOString(),
  };
}

Deno.serve(async (req) => {
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(url, serviceKey);

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const explicitPeriod = (body as { period?: string }).period;
    const target = explicitPeriod ?? getPreviousPeriod(new Date()).period;
    const [y, m] = target.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
    const end = new Date(Date.UTC(y, m, 1)).toISOString();

    // 1. 활성 영업사원 + 등급별 수수료율
    const [{ data: salesmen, error: smErr }, { data: grades, error: glErr }] = await Promise.all([
      supabase
        .from('salesman_profiles')
        .select('id, grade, status')
        .eq('status', 'active'),
      supabase.from('salesman_grade_levels').select('level, commission_rate'),
    ]);
    if (smErr) throw smErr;
    if (glErr) throw glErr;

    const gradeMap = new Map<string, number>();
    for (const g of (grades ?? []) as GradeRow[]) gradeMap.set(g.level, Number(g.commission_rate));

    // 2. 영업사원별 매출 합산 → settlements upsert
    const created: string[] = [];
    const skipped: string[] = [];
    for (const sm of (salesmen ?? []) as SalesmanRow[]) {
      const { data: ord, error: oErr } = await supabase
        .from('orders')
        .select('total_amount, created_at')
        .eq('salesman_id', sm.id)
        .gte('created_at', start)
        .lt('created_at', end);
      if (oErr) {
        console.error(`[settlement-close] orders fetch failed for ${sm.id}:`, oErr);
        continue;
      }
      const gross = ((ord ?? []) as OrderRow[]).reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
      if (gross <= 0) {
        skipped.push(sm.id);
        continue;
      }
      const rate = gradeMap.get(sm.grade ?? 'LV0') ?? 0.02;
      const commission = Math.floor(gross * rate);

      const { error: upErr } = await supabase
        .from('salesman_monthly_settlements')
        .upsert(
          {
            salesman_id: sm.id,
            settlement_period: target,
            gross_revenue: gross,
            commission_rate_applied: rate,
            commission_amount: commission,
            status: 'calculated',
            note: 'auto_close_cron',
          },
          { onConflict: 'salesman_id,settlement_period', ignoreDuplicates: false }
        );
      if (upErr) {
        console.error(`[settlement-close] upsert failed for ${sm.id}:`, upErr);
        continue;
      }
      created.push(sm.id);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        period: target,
        processed: created.length,
        skipped: skipped.length,
        salesmen_total: salesmen?.length ?? 0,
      }),
      { headers: { 'content-type': 'application/json' } }
    );
  } catch (err) {
    console.error('[settlement-close] error:', err);
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
});

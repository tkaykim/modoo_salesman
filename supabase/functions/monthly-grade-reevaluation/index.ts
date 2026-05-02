// Edge Function: 매월 등급 재평가
// 직전 3개월 매출 평균이 임계값을 충족하면 자동 승급/강등
// 권장 cron: 매월 1일 새벽 (settlement-close 직후)
// salesman_profiles.grade UPDATE → 트리거가 grade_changes 자동 기록

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

interface SalesmanRow { id: string; grade: string | null; status: string | null }
interface SettlementRow { gross_revenue: number; settlement_period: string }
interface GradeRow { level: string; monthly_revenue_threshold: number; display_order: number }

function getRecent3Periods(now: Date): string[] {
  const out: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

Deno.serve(async (req) => {
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(url, serviceKey);

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const dryRun = (body as { dryRun?: boolean }).dryRun === true;

    const periods = getRecent3Periods(new Date());

    const [{ data: salesmen, error: smErr }, { data: grades, error: glErr }] = await Promise.all([
      supabase
        .from('salesman_profiles')
        .select('id, grade, status')
        .eq('status', 'active'),
      supabase
        .from('salesman_grade_levels')
        .select('level, monthly_revenue_threshold, display_order')
        .order('display_order', { ascending: true }),
    ]);
    if (smErr) throw smErr;
    if (glErr) throw glErr;
    const gradeList = (grades ?? []) as GradeRow[];

    const promotions: { id: string; from: string | null; to: string; avg: number }[] = [];

    for (const sm of (salesmen ?? []) as SalesmanRow[]) {
      const { data: settlements, error: sErr } = await supabase
        .from('salesman_monthly_settlements')
        .select('gross_revenue, settlement_period')
        .eq('salesman_id', sm.id)
        .in('settlement_period', periods);
      if (sErr) {
        console.error(`[grade-reeval] settlements fetch failed for ${sm.id}:`, sErr);
        continue;
      }
      const arr = (settlements ?? []) as SettlementRow[];
      // 0매출 달도 평균에 포함 (3으로 나눔)
      const totalGross = arr.reduce((s, r) => s + (Number(r.gross_revenue) || 0), 0);
      const avg = totalGross / 3;

      // 해당하는 가장 높은 등급 찾기 (threshold ≤ avg)
      let target: GradeRow | null = null;
      for (const g of gradeList) {
        if (avg >= Number(g.monthly_revenue_threshold)) target = g;
        else break;
      }
      if (!target) target = gradeList[0]; // LV0 fallback

      if (target.level !== sm.grade) {
        promotions.push({ id: sm.id, from: sm.grade, to: target.level, avg });
        if (!dryRun) {
          const { error: upErr } = await supabase
            .from('salesman_profiles')
            .update({ grade: target.level })
            .eq('id', sm.id);
          if (upErr) {
            console.error(`[grade-reeval] grade update failed for ${sm.id}:`, upErr);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        dryRun,
        evaluated: salesmen?.length ?? 0,
        changed: promotions.length,
        promotions,
        periods,
      }),
      { headers: { 'content-type': 'application/json' } }
    );
  } catch (err) {
    console.error('[grade-reeval] error:', err);
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
});

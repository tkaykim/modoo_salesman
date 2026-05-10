// Edge Function: 월별 등급 재평가
// 정책 테이블(salesman_grade_policy) 기준으로 동작:
//   - 평가 윈도우 N개월 평균 매출
//   - 승급: avg ≥ next.monthly_revenue_threshold → 한 단계 또는 다단계 승급
//   - 유지 미달: avg < current.maintain_threshold → consecutive_below_threshold 증가
//   - 강등: consecutive_below_threshold > grace → max_steps 만큼 강등 + 카운터 리셋
//   - 수동 잠금: grade_locked_until > now() 면 평가 스킵
//   - 휴면/이탈은 자동 전환하지 않음 (정책 dormant/churned 임계는 admin UI 경고용으로만 사용)
//   - 모든 변경은 salesman_grade_changes 에 기록
// 호출:
//   POST { dryRun?: boolean, salesmanIds?: string[] }
//   - salesmanIds 미지정 시 active+dormant 전체

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

interface SalesmanRow {
  id: string;
  grade: string | null;
  status: string | null;
  grade_locked_until: string | null;
  consecutive_below_threshold: number | null;
  last_active_at: string | null;
}

interface SettlementRow {
  gross_revenue: number | null;
  settlement_period: string;
}

interface GradeRow {
  level: string;
  monthly_revenue_threshold: number;
  maintain_threshold: number | null;
  display_order: number;
}

interface PolicyRow {
  evaluation_window_months: number;
  manual_lock_months: number;
  demotion_grace_periods: number;
  demotion_max_steps: number;
  dormant_inactive_months: number;
  churned_inactive_months: number;
  default_maintain_ratio: number;
  auto_reevaluation_enabled: boolean;
}

type ChangeReason =
  | 'auto_promote'
  | 'auto_demote'
  | 'auto_grace';

function recentPeriods(now: Date, n: number): string[] {
  const out: string[] = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

function findGradeByLevel(levels: GradeRow[], level: string | null): GradeRow | null {
  return levels.find((g) => g.level === level) ?? null;
}

// 등급 변경 시 trg_log_salesman_grade_change 트리거가 prev_level/new_level/reason='manual_change' 기본값으로 자동 INSERT 한다.
// 이후 가장 최근 row 의 reason/평가 컨텍스트를 보강한다.
// grade 변경이 없는 noop/grace 의 경우는 직접 INSERT.
async function logChange(
  supabase: SupabaseClient,
  salesmanId: string,
  fromGrade: string | null,
  toGrade: string,
  reason: ChangeReason,
  windowMonths: number,
  avgRevenue: number,
  periods: string[],
  note?: string
) {
  if (fromGrade !== toGrade) {
    // 트리거가 만든 row 보강
    const { data: latest } = await supabase
      .from('salesman_grade_changes')
      .select('id')
      .eq('salesman_id', salesmanId)
      .order('changed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest?.id) {
      await supabase
        .from('salesman_grade_changes')
        .update({
          reason,
          evaluation_window_months: windowMonths,
          evaluated_avg_revenue: Math.floor(avgRevenue),
          evaluated_periods: periods,
          note: note ?? null,
        })
        .eq('id', latest.id);
      return;
    }
  }
  // 등급 변경이 없는 grace 등은 직접 INSERT
  await supabase.from('salesman_grade_changes').insert({
    salesman_id: salesmanId,
    prev_level: fromGrade,
    new_level: toGrade,
    reason,
    evaluation_window_months: windowMonths,
    evaluated_avg_revenue: Math.floor(avgRevenue),
    evaluated_periods: periods,
    note: note ?? null,
  });
}

Deno.serve(async (req) => {
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(url, serviceKey);

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const dryRun = (body as { dryRun?: boolean }).dryRun === true;
    const salesmanIds = (body as { salesmanIds?: string[] }).salesmanIds;

    // 정책 로드
    const { data: policyRow, error: pErr } = await supabase
      .from('salesman_grade_policy')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (pErr) throw pErr;
    const policy: PolicyRow = (policyRow ?? {
      evaluation_window_months: 3,
      manual_lock_months: 3,
      demotion_grace_periods: 1,
      demotion_max_steps: 1,
      dormant_inactive_months: 3,
      churned_inactive_months: 6,
      default_maintain_ratio: 0.7,
      auto_reevaluation_enabled: true,
    }) as PolicyRow;

    if (!policy.auto_reevaluation_enabled && !dryRun && !salesmanIds) {
      return new Response(
        JSON.stringify({ ok: true, skipped: 'auto_reevaluation_disabled' }),
        { headers: { 'content-type': 'application/json' } }
      );
    }

    const periods = recentPeriods(new Date(), policy.evaluation_window_months);

    // 등급 마스터
    const { data: grades, error: gErr } = await supabase
      .from('salesman_grade_levels')
      .select('level, monthly_revenue_threshold, maintain_threshold, display_order')
      .order('display_order', { ascending: true });
    if (gErr) throw gErr;
    const gradeList = (grades ?? []) as GradeRow[];
    const lowestGrade = gradeList[0];

    // 평가 대상
    let smQuery = supabase
      .from('salesman_profiles')
      .select(
        'id, grade, status, grade_locked_until, consecutive_below_threshold, last_active_at'
      )
      .eq('status', 'active');
    if (salesmanIds && salesmanIds.length > 0) {
      smQuery = smQuery.in('id', salesmanIds);
    }
    const { data: salesmen, error: sErr } = await smQuery;
    if (sErr) throw sErr;

    const nowIso = new Date().toISOString();
    const results: Array<{
      id: string;
      action: 'promoted' | 'demoted' | 'grace' | 'noop' | 'locked' | 'reset';
      from?: string | null;
      to?: string | null;
      avg?: number;
      consecutive?: number;
    }> = [];

    for (const sm of (salesmen ?? []) as SalesmanRow[]) {
      // 잠금 확인
      if (
        sm.grade_locked_until &&
        new Date(sm.grade_locked_until).getTime() > Date.now()
      ) {
        results.push({ id: sm.id, action: 'locked' });
        continue;
      }

      const { data: settlements, error: stErr } = await supabase
        .from('salesman_monthly_settlements')
        .select('gross_revenue, settlement_period')
        .eq('salesman_id', sm.id)
        .in('settlement_period', periods);
      if (stErr) {
        console.error(`[grade-reeval] settlements fetch ${sm.id}`, stErr);
        continue;
      }
      const arr = (settlements ?? []) as SettlementRow[];
      const totalGross = arr.reduce((s, r) => s + (Number(r.gross_revenue) || 0), 0);
      const avg = totalGross / Math.max(1, policy.evaluation_window_months);

      // 휴면/이탈 자동 전환 없음 — status 전이는 관리자 수동 결정.
      // (정책 dormant_inactive_months / churned_inactive_months 는 UI 경고 임계로만 사용)

      // 등급 평가
      const current = findGradeByLevel(gradeList, sm.grade) ?? lowestGrade;
      const currentIdx = gradeList.findIndex((g) => g.level === current.level);

      // 다음 등급으로 승급 가능한가? (top-down 으로 가장 높은 충족 등급 탐색)
      let target = current;
      for (const g of gradeList) {
        if (avg >= Number(g.monthly_revenue_threshold)) target = g;
        else break;
      }
      const targetIdx = gradeList.findIndex((g) => g.level === target.level);

      if (targetIdx > currentIdx) {
        // 승급
        if (!dryRun) {
          await supabase
            .from('salesman_profiles')
            .update({
              grade: target.level,
              consecutive_below_threshold: 0,
              last_grade_evaluated_at: nowIso,
            })
            .eq('id', sm.id);
          await logChange(
            supabase,
            sm.id,
            sm.grade,
            target.level,
            'auto_promote',
            policy.evaluation_window_months,
            avg,
            periods
          );
        }
        results.push({ id: sm.id, action: 'promoted', from: sm.grade, to: target.level, avg });
        continue;
      }

      // 유지 임계 미달 검사
      const maintain =
        Number(current.maintain_threshold ?? 0) ||
        Math.floor(Number(current.monthly_revenue_threshold) * policy.default_maintain_ratio);

      if (avg < maintain && currentIdx > 0 && policy.demotion_max_steps > 0) {
        const newCount = (sm.consecutive_below_threshold ?? 0) + 1;
        if (newCount > policy.demotion_grace_periods) {
          // 강등
          const stepsDown = Math.min(policy.demotion_max_steps, currentIdx);
          const demoted = gradeList[currentIdx - stepsDown];
          if (!dryRun) {
            await supabase
              .from('salesman_profiles')
              .update({
                grade: demoted.level,
                consecutive_below_threshold: 0,
                last_grade_evaluated_at: nowIso,
              })
              .eq('id', sm.id);
            await logChange(
              supabase,
              sm.id,
              sm.grade,
              demoted.level,
              'auto_demote',
              policy.evaluation_window_months,
              avg,
              periods,
              `유지 미달 ${newCount}회 → ${stepsDown}단계 강등`
            );
          }
          results.push({
            id: sm.id,
            action: 'demoted',
            from: sm.grade,
            to: demoted.level,
            avg,
            consecutive: newCount,
          });
          continue;
        } else {
          // grace
          if (!dryRun) {
            await supabase
              .from('salesman_profiles')
              .update({
                consecutive_below_threshold: newCount,
                last_grade_evaluated_at: nowIso,
              })
              .eq('id', sm.id);
            await logChange(
              supabase,
              sm.id,
              sm.grade,
              sm.grade ?? lowestGrade.level,
              'auto_grace',
              policy.evaluation_window_months,
              avg,
              periods,
              `유지 미달 grace ${newCount}/${policy.demotion_grace_periods + 1}`
            );
          }
          results.push({
            id: sm.id,
            action: 'grace',
            from: sm.grade,
            to: sm.grade,
            avg,
            consecutive: newCount,
          });
          continue;
        }
      }

      // 유지 정상 — 카운터 리셋만
      if ((sm.consecutive_below_threshold ?? 0) > 0) {
        if (!dryRun) {
          await supabase
            .from('salesman_profiles')
            .update({ consecutive_below_threshold: 0, last_grade_evaluated_at: nowIso })
            .eq('id', sm.id);
        }
        results.push({ id: sm.id, action: 'reset', from: sm.grade, to: sm.grade, avg });
      } else {
        if (!dryRun) {
          await supabase
            .from('salesman_profiles')
            .update({ last_grade_evaluated_at: nowIso })
            .eq('id', sm.id);
        }
        results.push({ id: sm.id, action: 'noop', from: sm.grade, to: sm.grade, avg });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        dryRun,
        evaluated: salesmen?.length ?? 0,
        results,
        periods,
        policy,
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

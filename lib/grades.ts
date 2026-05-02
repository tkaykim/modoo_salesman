// 영업사원 등급: Lv.0 (서포터즈) ~ Lv.10 (마스터)
// DB salesman_grade_levels 테이블과 동일 구조 (fallback 용 하드코딩)

export type GradeLevel =
  | 'LV0' | 'LV1' | 'LV2' | 'LV3' | 'LV4' | 'LV5'
  | 'LV6' | 'LV7' | 'LV8' | 'LV9' | 'LV10';

export interface GradeInfo {
  level: GradeLevel;
  label: string;
  shortLabel: string;        // "Lv.0", "Lv.10" 등 칩용
  commissionRate: number;    // 0.020 = 2%
  monthlyThreshold: number;  // 승급 기준 (원)
  displayOrder: number;
  badgeColor: string;
  trackColor: string;
}

export const GRADES: Record<GradeLevel, GradeInfo> = {
  LV0:  { level: 'LV0',  label: '서포터즈', shortLabel: 'Lv.0',  commissionRate: 0.020, monthlyThreshold: 0,         displayOrder: 0,  badgeColor: 'text-slate-300',  trackColor: 'bg-slate-400' },
  LV1:  { level: 'LV1',  label: 'Lv.1',     shortLabel: 'Lv.1',  commissionRate: 0.050, monthlyThreshold: 1_000_000, displayOrder: 1,  badgeColor: 'text-emerald-300', trackColor: 'bg-emerald-400' },
  LV2:  { level: 'LV2',  label: 'Lv.2',     shortLabel: 'Lv.2',  commissionRate: 0.080, monthlyThreshold: 3_000_000, displayOrder: 2,  badgeColor: 'text-emerald-300', trackColor: 'bg-emerald-400' },
  LV3:  { level: 'LV3',  label: 'Lv.3',     shortLabel: 'Lv.3',  commissionRate: 0.100, monthlyThreshold: 5_000_000, displayOrder: 3,  badgeColor: 'text-cyan-300',    trackColor: 'bg-cyan-400' },
  LV4:  { level: 'LV4',  label: 'Lv.4',     shortLabel: 'Lv.4',  commissionRate: 0.120, monthlyThreshold: 8_000_000, displayOrder: 4,  badgeColor: 'text-cyan-300',    trackColor: 'bg-cyan-400' },
  LV5:  { level: 'LV5',  label: 'Lv.5',     shortLabel: 'Lv.5',  commissionRate: 0.140, monthlyThreshold: 12_000_000, displayOrder: 5, badgeColor: 'text-blue-300',    trackColor: 'bg-blue-400' },
  LV6:  { level: 'LV6',  label: 'Lv.6',     shortLabel: 'Lv.6',  commissionRate: 0.160, monthlyThreshold: 18_000_000, displayOrder: 6, badgeColor: 'text-blue-300',    trackColor: 'bg-blue-400' },
  LV7:  { level: 'LV7',  label: 'Lv.7',     shortLabel: 'Lv.7',  commissionRate: 0.180, monthlyThreshold: 25_000_000, displayOrder: 7, badgeColor: 'text-violet-300',  trackColor: 'bg-violet-400' },
  LV8:  { level: 'LV8',  label: 'Lv.8',     shortLabel: 'Lv.8',  commissionRate: 0.200, monthlyThreshold: 35_000_000, displayOrder: 8, badgeColor: 'text-violet-300',  trackColor: 'bg-violet-400' },
  LV9:  { level: 'LV9',  label: 'Lv.9',     shortLabel: 'Lv.9',  commissionRate: 0.220, monthlyThreshold: 50_000_000, displayOrder: 9, badgeColor: 'text-yellow-400',  trackColor: 'bg-yellow-400' },
  LV10: { level: 'LV10', label: '마스터',   shortLabel: 'Lv.10', commissionRate: 0.250, monthlyThreshold: 70_000_000, displayOrder: 10, badgeColor: 'text-yellow-400', trackColor: 'bg-yellow-400' },
};

export const ALL_GRADES: GradeInfo[] = Object.values(GRADES).sort((a, b) => a.displayOrder - b.displayOrder);

export const DEFAULT_GRADE: GradeLevel = 'LV0';

export function getGrade(level: string | null | undefined): GradeInfo {
  if (!level) return GRADES[DEFAULT_GRADE];
  return GRADES[level as GradeLevel] ?? GRADES[DEFAULT_GRADE];
}

export function getNextGrade(level: GradeLevel): GradeInfo | null {
  const current = GRADES[level];
  return ALL_GRADES.find((g) => g.displayOrder === current.displayOrder + 1) ?? null;
}

'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Icon, type IconName, Chip } from '@/components/ui';
import { createClient } from '@/lib/supabase-client';
import type { Team } from '@/lib/teams';

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`;

interface AcademyTabProps {
  teams: Team[];
  totalRevenue: number;
  onStartVisit: () => void;
  onOpenTeam: (teamId: string) => void;
}

type LessonId = 'intro' | 'prospect' | 'script' | 'first-mall';

interface Lesson {
  id: LessonId;
  title: string;
  category: '필수' | '영업' | '앱실습';
  minutes: number;
  reward: number;
  icon: IconName;
  summary: string;
}

interface Mission {
  id: string;
  title: string;
  desc: string;
  reward: number;
  done: boolean;
  icon: IconName;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const LESSONS: Lesson[] = [
  {
    id: 'intro',
    title: '모두 파트너스 구조 이해',
    category: '필수',
    minutes: 6,
    reward: 1000,
    icon: 'verified',
    summary: '단체복 주문 연결, 본사 제작 지원, 수수료 정산 구조를 익힙니다.',
  },
  {
    id: 'prospect',
    title: '첫 단체 후보 찾기',
    category: '영업',
    minutes: 8,
    reward: 2000,
    icon: 'target',
    summary: '학교, 동호회, 학원, 매장 중 빠르게 첫 주문이 나오는 후보를 고릅니다.',
  },
  {
    id: 'script',
    title: '첫 메시지 스크립트',
    category: '영업',
    minutes: 5,
    reward: 2000,
    icon: 'send',
    summary: '아는 단체에 부담 없이 보내는 연락 문구와 후속 질문을 익힙니다.',
  },
  {
    id: 'first-mall',
    title: '첫 단체몰 만들기',
    category: '앱실습',
    minutes: 10,
    reward: 3000,
    icon: 'qr',
    summary: '단체 등록, 로고 업로드, 제품 진열, 공유 링크 전달까지 실습합니다.',
  },
];

const STORAGE_KEY = 'modoo-partner-academy-lessons-v1';

export default function AcademyTab({ teams, totalRevenue, onStartVisit, onOpenTeam }: AcademyTabProps) {
  const [completedLessons, setCompletedLessons] = useState<Set<LessonId>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        return new Set(parsed.filter((id): id is LessonId => LESSONS.some((lesson) => lesson.id === id)));
      }
    } catch {}
    return new Set();
  });
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('all');
  const [copied, setCopied] = useState(false);

  const teamIds = useMemo(() => teams.map((team) => team.id).sort(), [teams]);
  const { data: productCount = 0 } = useSWR(
    teamIds.length > 0 ? ['academy-product-count', teamIds.join(',')] : null,
    async () => {
      const supabase = createClient();
      const { count, error } = await supabase
        .from('partner_mall_products')
        .select('id', { count: 'exact', head: true })
        .in('partner_mall_id', teamIds);
      if (error) {
        return 0;
      }
      return count ?? 0;
    },
  );

  const toggleLesson = (id: LessonId) => {
    setCompletedLessons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const firstTeam = teams[0] ?? null;
  const hasLogo = teams.some((team) => !!team.logoUrl);
  const hasShareLink = teams.some((team) => !!team.shareToken);
  const hasPaidOrder = totalRevenue > 0;

  const missions: Mission[] = useMemo(
    () => [
      {
        id: 'login',
        title: '파트너 앱 입장',
        desc: '승인된 계정으로 앱에 들어왔습니다.',
        reward: 0,
        done: true,
        icon: 'check',
      },
      {
        id: 'first-team',
        title: '첫 단체 등록',
        desc: '주문 가능성이 있는 단체를 하나 등록합니다.',
        reward: 5000,
        done: teams.length > 0,
        icon: 'group',
        action: teams.length > 0 ? undefined : { label: '단체 등록', onClick: onStartVisit },
      },
      {
        id: 'first-logo',
        title: '로고 자료 확보',
        desc: '단체 로고나 인쇄 이미지를 등록합니다.',
        reward: 5000,
        done: hasLogo,
        icon: 'image',
        action: !hasLogo && firstTeam ? { label: '로고 등록', onClick: () => onOpenTeam(firstTeam.id) } : undefined,
      },
      {
        id: 'first-product',
        title: '제품 1개 진열',
        desc: '고객이 바로 볼 수 있는 단체몰 상품을 만듭니다.',
        reward: 5000,
        done: productCount > 0,
        icon: 'package',
        action: productCount === 0 && firstTeam ? { label: '제품 만들기', onClick: () => onOpenTeam(firstTeam.id) } : undefined,
      },
      {
        id: 'share',
        title: '공유 링크 준비',
        desc: '담당자에게 보낼 QR 또는 링크를 준비합니다.',
        reward: 3000,
        done: hasShareLink,
        icon: 'share',
        action: hasShareLink && firstTeam ? { label: '공유 열기', onClick: () => onOpenTeam(firstTeam.id) } : undefined,
      },
      {
        id: 'first-order',
        title: '첫 결제 주문',
        desc: '첫 결제 주문이 발생하면 실전 보너스 대상이 됩니다.',
        reward: 30000,
        done: hasPaidOrder,
        icon: 'trophy',
      },
      {
        id: 'three-teams',
        title: '단체 3곳 운영',
        desc: '한 곳에 의존하지 않는 파트너 풀을 만듭니다.',
        reward: 20000,
        done: teams.length >= 3,
        icon: 'briefcase',
        action: teams.length < 3 ? { label: '추가 등록', onClick: onStartVisit } : undefined,
      },
    ],
    [firstTeam, hasLogo, hasPaidOrder, hasShareLink, onOpenTeam, onStartVisit, productCount, teams.length],
  );

  const lessonReward = LESSONS.reduce(
    (sum, lesson) => sum + (completedLessons.has(lesson.id) ? lesson.reward : 0),
    0,
  );
  const missionReward = missions.reduce((sum, mission) => sum + (mission.done ? mission.reward : 0), 0);
  const maxReward = LESSONS.reduce((sum, lesson) => sum + lesson.reward, 0)
    + missions.reduce((sum, mission) => sum + mission.reward, 0);
  const doneMissions = missions.filter((mission) => mission.done).length;
  const progress = Math.round(((completedLessons.size + doneMissions) / (LESSONS.length + missions.length)) * 100);
  const filteredLessons = LESSONS.filter((lesson) => {
    if (filter === 'done') return completedLessons.has(lesson.id);
    if (filter === 'todo') return !completedLessons.has(lesson.id);
    return true;
  });

  const copyScript = async () => {
    const text = [
      '안녕하세요.',
      '단체복이나 팀복 제작하실 일이 있으면 모두의 유니폼 전용 단체몰로 편하게 견적과 주문을 도와드릴 수 있습니다.',
      '로고 자료만 있으면 제품 시안과 주문 링크까지 바로 만들어드릴게요.',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <div className="bg-[var(--color-surface-alt)] min-h-full pt-4 pb-8">
      <div className="px-4 mb-4">
        <p className="text-[11px] font-extrabold text-[var(--color-brand-500)] mb-1">
          MODOO PARTNERS SCHOOL
        </p>
        <h2 className="text-[20px] font-extrabold text-[var(--color-ink)] tracking-tight">
          첫 주문까지 가는 미션
        </h2>
        <p className="text-[12px] text-[var(--color-muted)] mt-1">
          교육을 보고 바로 단체몰을 만들어 실전으로 이어갑니다.
        </p>
      </div>

      <section className="px-3">
        <div
          className="rounded-[20px] bg-[var(--color-ink)] p-4 text-white"
          style={{ boxShadow: 'var(--shadow-hero)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] text-white/65 font-bold">적립 예정 리워드</p>
              <p className="text-[28px] font-black tracking-tight mt-1">
                {won(lessonReward + missionReward)}
              </p>
              <p className="text-[11px] text-white/60 mt-1">
                최대 {won(maxReward)} 중 {progress}% 완료
              </p>
            </div>
            <div className="w-14 h-14 rounded-[18px] bg-white/10 flex items-center justify-center flex-shrink-0">
              <Icon name="gift" size={28} color="white" strokeWidth={2} />
            </div>
          </div>
          <div className="mt-4 h-2 rounded-full bg-white/15 overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-gold)]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <HeroStat label="교육" value={`${completedLessons.size}/${LESSONS.length}`} />
            <HeroStat label="미션" value={`${doneMissions}/${missions.length}`} />
            <HeroStat label="단체" value={`${teams.length}곳`} />
          </div>
        </div>
      </section>

      <section className="px-3 mt-3">
        <button
          onClick={onStartVisit}
          className="w-full rounded-[16px] bg-[var(--color-brand-500)] px-4 py-3.5 text-left text-white active:bg-[var(--color-brand-600)]"
          style={{ boxShadow: 'var(--shadow-cta)' }}
        >
          <div className="flex items-center gap-3">
            <Icon name="bolt" size={22} color="white" strokeWidth={2} />
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-extrabold">첫 단체몰 바로 만들기</div>
              <div className="text-[11px] text-white/75 mt-0.5">등록 후 제품과 공유 링크까지 이어집니다</div>
            </div>
            <Icon name="chevron-r" size={18} color="rgba(255,255,255,0.78)" />
          </div>
        </button>
      </section>

      <SectionTitle title="학습 코스" right={`${LESSONS.length}개`} />
      <div className="px-3 flex gap-1.5 overflow-x-auto pb-2">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>전체</Chip>
        <Chip active={filter === 'todo'} onClick={() => setFilter('todo')}>미완료</Chip>
        <Chip active={filter === 'done'} onClick={() => setFilter('done')}>완료</Chip>
      </div>
      <div className="px-3 space-y-2">
        {filteredLessons.map((lesson) => (
          <LessonCard
            key={lesson.id}
            lesson={lesson}
            done={completedLessons.has(lesson.id)}
            onToggle={() => toggleLesson(lesson.id)}
          />
        ))}
      </div>

      <SectionTitle title="실전 미션" right={`${doneMissions}/${missions.length}`} />
      <div className="px-3 space-y-2">
        {missions.map((mission) => (
          <MissionRow key={mission.id} mission={mission} />
        ))}
      </div>

      <SectionTitle title="상담 스크립트" right={copied ? '복사됨' : '복사'} onRight={copyScript} />
      <div className="px-3">
        <div
          className="rounded-[16px] bg-white p-4"
          style={{ border: '1px solid var(--color-hairline-soft)', boxShadow: 'var(--shadow-card-flat)' }}
        >
          <p className="text-[13px] leading-relaxed text-[var(--color-body)]">
            안녕하세요.
            <br />
            단체복이나 팀복 제작하실 일이 있으면 모두의 유니폼 전용 단체몰로 편하게 견적과 주문을 도와드릴 수 있습니다.
            <br />
            로고 자료만 있으면 제품 시안과 주문 링크까지 바로 만들어드릴게요.
          </p>
        </div>
      </div>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] bg-white/10 px-3 py-2">
      <div className="text-[10px] text-white/55 font-bold">{label}</div>
      <div className="text-[14px] font-extrabold mt-0.5">{value}</div>
    </div>
  );
}

function SectionTitle({
  title,
  right,
  onRight,
}: {
  title: string;
  right?: string;
  onRight?: () => void;
}) {
  return (
    <div className="px-4 mt-5 mb-2 flex items-center justify-between">
      <h3 className="text-[15px] font-extrabold text-[var(--color-ink)] tracking-tight">{title}</h3>
      {right ? (
        <button
          type="button"
          onClick={onRight}
          className="text-[11px] font-bold text-[var(--color-brand-500)] disabled:text-[var(--color-faint)]"
          disabled={!onRight}
        >
          {right}
        </button>
      ) : null}
    </div>
  );
}

function LessonCard({ lesson, done, onToggle }: { lesson: Lesson; done: boolean; onToggle: () => void }) {
  return (
    <div
      className="rounded-[16px] bg-white p-3.5"
      style={{ border: '1px solid var(--color-hairline-soft)', boxShadow: 'var(--shadow-card-flat)' }}
    >
      <div className="flex gap-3">
        <div
          className="w-12 h-12 rounded-[14px] flex items-center justify-center flex-shrink-0"
          style={{ background: done ? 'var(--color-pos-soft)' : 'var(--color-brand-100)' }}
        >
          <Icon
            name={done ? 'check' : lesson.icon}
            size={22}
            color={done ? 'var(--color-pos)' : 'var(--color-brand-500)'}
            strokeWidth={2}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-extrabold text-[var(--color-muted)]">{lesson.category}</span>
            <span className="text-[10px] text-[var(--color-faint)]">· {lesson.minutes}분</span>
            <span className="text-[10px] font-bold text-[var(--color-gold-deep)]">+{won(lesson.reward)}</span>
          </div>
          <h4 className="text-[14px] font-extrabold text-[var(--color-ink)] tracking-tight">
            {lesson.title}
          </h4>
          <p className="text-[11px] text-[var(--color-muted)] leading-relaxed mt-1">
            {lesson.summary}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`mt-3 w-full rounded-[12px] py-2.5 text-[13px] font-bold ${
          done
            ? 'bg-[var(--color-pos-soft)] text-[var(--color-pos)]'
            : 'bg-[var(--color-ink)] text-white'
        }`}
      >
        {done ? '수강 완료됨' : '수강 완료 체크'}
      </button>
    </div>
  );
}

function MissionRow({ mission }: { mission: Mission }) {
  return (
    <div
      className="rounded-[16px] bg-white px-3.5 py-3 flex items-center gap-3"
      style={{ border: '1px solid var(--color-hairline-soft)', boxShadow: 'var(--shadow-card-flat)' }}
    >
      <div
        className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0"
        style={{
          background: mission.done ? 'var(--color-pos-soft)' : 'var(--color-surface-alt)',
          color: mission.done ? 'var(--color-pos)' : 'var(--color-muted)',
        }}
      >
        <Icon
          name={mission.done ? 'check' : mission.icon}
          size={20}
          color={mission.done ? 'var(--color-pos)' : 'var(--color-muted)'}
          strokeWidth={2}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <h4 className="text-[13px] font-extrabold text-[var(--color-ink)] tracking-tight truncate">
            {mission.title}
          </h4>
          {mission.reward > 0 && (
            <span className="text-[10px] font-bold text-[var(--color-gold-deep)] flex-shrink-0">
              +{won(mission.reward)}
            </span>
          )}
        </div>
        <p className="text-[11px] text-[var(--color-muted)] mt-0.5 truncate">{mission.desc}</p>
      </div>
      {mission.action && !mission.done ? (
        <button
          type="button"
          onClick={mission.action.onClick}
          className="rounded-[10px] bg-[var(--color-brand-100)] px-2.5 py-2 text-[11px] font-bold text-[var(--color-brand-500)]"
        >
          {mission.action.label}
        </button>
      ) : (
        <span
          className="rounded-full px-2 py-1 text-[10px] font-extrabold"
          style={{
            background: mission.done ? 'var(--color-pos-soft)' : 'var(--color-hairline-soft)',
            color: mission.done ? 'var(--color-pos)' : 'var(--color-faint)',
          }}
        >
          {mission.done ? '완료' : '대기'}
        </span>
      )}
    </div>
  );
}

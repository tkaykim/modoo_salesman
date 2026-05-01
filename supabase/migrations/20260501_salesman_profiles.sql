-- =====================================================================
-- 영업사원 프로파일 테이블
-- =====================================================================
-- 목적: 한 사용자(profiles)가 admin/customer/factory 역할과 동시에
-- 영업사원 자격을 가질 수 있도록 별도 테이블로 분리.
-- modoo_salesman 앱의 인증 가드는 profiles.role이 아니라
-- 이 테이블의 레코드 존재 + status=active 여부로 판단.
-- =====================================================================

CREATE TABLE IF NOT EXISTS salesman_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 영업사원 고유 코드 (예: SR-A1B2C3) — 매출 귀속 attribution에 사용
  salesman_code TEXT NOT NULL UNIQUE,

  -- 등급 (5단계 누진 수수료제)
  grade TEXT NOT NULL DEFAULT 'BRONZE'
    CHECK (grade IN ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND')),

  -- 활동 상태
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'dormant', 'churned')),

  -- 메타
  display_name TEXT,
  phone TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ,
  mentor_id UUID REFERENCES salesman_profiles(id),

  -- 메모
  note TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_salesman_profiles_user_id ON salesman_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_salesman_profiles_status ON salesman_profiles(status);
CREATE INDEX IF NOT EXISTS idx_salesman_profiles_grade ON salesman_profiles(grade);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION set_salesman_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_salesman_profiles_updated_at ON salesman_profiles;
CREATE TRIGGER trg_salesman_profiles_updated_at
  BEFORE UPDATE ON salesman_profiles
  FOR EACH ROW EXECUTE FUNCTION set_salesman_profiles_updated_at();

-- =====================================================================
-- RLS (Row Level Security)
-- =====================================================================
ALTER TABLE salesman_profiles ENABLE ROW LEVEL SECURITY;

-- 본인 레코드 조회
CREATE POLICY "Salesman can view own profile"
  ON salesman_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- admin/super_admin은 모든 영업사원 조회/수정 가능
CREATE POLICY "Admin can manage all salesman profiles"
  ON salesman_profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    )
  );

-- =====================================================================
-- 영업사원 코드 자동 생성 함수 (SR-XXXXXX 형식)
-- =====================================================================
CREATE OR REPLACE FUNCTION generate_salesman_code()
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    v_code := 'SR-' || UPPER(SUBSTRING(MD5(random()::TEXT) FROM 1 FOR 6));
    SELECT EXISTS(SELECT 1 FROM salesman_profiles WHERE salesman_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 코멘트
-- =====================================================================
COMMENT ON TABLE salesman_profiles IS '영업사원 프로파일. profiles와 1:1. user는 admin/customer 역할이면서도 영업사원 가능';
COMMENT ON COLUMN salesman_profiles.salesman_code IS '영업사원 고유 코드 (SR-XXXXXX). 견적/주문 attribution에 사용';
COMMENT ON COLUMN salesman_profiles.grade IS 'BRONZE(10%) → SILVER(15%) → GOLD(18%) → PLATINUM(22%) → DIAMOND(25%). 직전 3개월 평균 매출 자동 산정';
COMMENT ON COLUMN salesman_profiles.status IS 'active=활성, dormant=3개월+ 비활동, churned=이탈';

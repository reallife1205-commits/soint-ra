-- 모듈4: 항공사진 객체/시설 수동 태깅 테이블
-- Supabase SQL Editor에서 실행하세요.

create extension if not exists pgcrypto;

create table if not exists aerial_photo_tags (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  -- 좌표는 이미지 대비 비율(0~1)로 저장해서 화면 크기가 달라져도 정확히 표시돼요
  x numeric not null,
  y numeric not null,
  width numeric not null,
  height numeric not null,
  facility_type text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_aerial_photo_tags_document on aerial_photo_tags(document_id);
create index if not exists idx_aerial_photo_tags_case on aerial_photo_tags(case_id);

-- 기존 테이블들(module_rows, documents 등)이 anon 키로 직접 CRUD 되는 방식과
-- 동일하게 맞췄어요. 만약 기존 테이블에 RLS가 켜져 있고 별도 정책이 있다면
-- 아래 정책 대신 그 정책을 그대로 복사해서 적용해주세요.
alter table aerial_photo_tags enable row level security;

drop policy if exists "aerial_photo_tags_allow_all" on aerial_photo_tags;
create policy "aerial_photo_tags_allow_all"
  on aerial_photo_tags
  for all
  using (true)
  with check (true);

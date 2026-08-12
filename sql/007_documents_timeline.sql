-- 모듈4 타임라인용: 문서(항공사진)에 촬영연도, 관찰 메모 컬럼 추가
-- Supabase SQL Editor에서 실행하세요.

alter table documents
  add column if not exists photo_year integer;

alter table documents
  add column if not exists photo_note text;

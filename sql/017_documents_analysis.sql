-- 3.1 소유·점유·운영: [표 4]~[표 6]처럼 양식이 정해지지 않은 증빙 표(이미지/PDF)를
-- 업로드하고 Claude 비전으로 간단한 분석을 붙여둘 수 있도록 documents에 analysis 컬럼 추가
-- Supabase SQL Editor에서 실행하세요.

alter table documents
  add column if not exists analysis text;

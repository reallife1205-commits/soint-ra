-- 챕터01 "시료채취지점"/"오염분포도" 탭용: 문서(사진)를 참고 문서와 구분하기 위한 카테고리 컬럼 추가
-- Supabase SQL Editor에서 실행하세요.
-- category가 NULL이면 기존 "참고 문서"(왼쪽 사이드바 업로드)이고,
-- 'sample_points' / 'pollution_map' 등은 챕터01 하위 탭 전용 이미지예요.

alter table documents
  add column if not exists category text;

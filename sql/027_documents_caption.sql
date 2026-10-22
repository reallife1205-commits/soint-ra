-- 4장 현장 사진의 "보고서 제목". 지금까지는 사진을 올린 항목 칸 이름(특정토양오염관리대상시설 등)이
-- 그대로 보고서 사진 제목이 됐는데, 사용자가 사진마다 제목을 직접 적을 수 있게 따로 저장한다.
-- (photo_note는 어느 항목 칸에 올린 사진인지 구분하는 데 계속 쓴다.)
-- Supabase SQL Editor에서 실행하세요.

alter table documents
  add column if not exists caption text;

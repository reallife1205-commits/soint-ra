-- 항공사진에 부지 경계선을 그리면 그 사진 자리에 경계선 사진을 바꿔 넣는다(BoundaryDrawer.replaceWithBoundary).
-- 원본 파일은 저장소에 남겨 두고, 그 위치·이름을 여기 적어 두어 "원본으로 되돌리기"로 되돌릴 수 있게 한다.
-- 이 열이 생기기 전에 그린 사진은 값이 비어 있다 — 그땐 같은 폴더에서 어떤 사진도 쓰지 않는 파일을 후보로 보여 주고 고르게 한다.
alter table documents add column if not exists original_file_path text;
alter table documents add column if not exists original_file_name text;

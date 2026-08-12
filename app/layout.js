import "./globals.css";

export const metadata = {
  title: "토담 土潭 | 토양정화 기술검토 · 인벤토리 플랫폼",
  description: "토양정화 기술검토 리포트 작성과 토양 인벤토리 관리를 한 곳에서",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

import "./globals.css";

export const metadata = {
  title: "SOINT-RA | 토양정화자문위원회 기술검토 지원 시스템",
  description: "토양정화자문위원회 기술검토 지원 시스템",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

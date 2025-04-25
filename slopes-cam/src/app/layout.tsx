import type { Metadata } from "next";
import { Pretendard } from "next/font/google";
import "./globals.css";

const pretendard = Pretendard({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-pretendard",
});

export const metadata: Metadata = {
  title: "전국 스키장 실시간 웹캠 모음",
  description: "Slopes cam - 전국 스키장 실시간 웹캠 모음",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css" />
        <script async defer src="https://buttons.github.io/buttons.js"></script>
      </head>
      <body className={`${pretendard.variable}`}>
        {children}
      </body>
    </html>
  );
}

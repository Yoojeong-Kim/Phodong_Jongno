import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "포동 체험 | 우리 집 물건으로 만드는 맞춤 동화",
  description: "장르와 사물을 선택하고 포동의 맞춤 동화 만들기를 가볍게 체험해보세요.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}

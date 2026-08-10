import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "포동 이야기 놀이터 | 사진으로 만드는 우리 가족 동화",
  description: "가족을 상징하는 물건을 촬영하고 다양한 문화의 이야기를 담은 나만의 동화를 만들어보세요.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}

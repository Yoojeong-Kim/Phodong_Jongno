import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "포동 이야기 놀이터 | 사진으로 만드는 우리 가족 동화",
  description: "가족을 상징하는 물건을 촬영하고 다양한 문화의 이야기를 담은 나만의 동화를 만들어보세요.",
  openGraph: {
    title: "포동 이야기 놀이터",
    description: "사진 한 장으로 시작하는 우리 가족의 여섯 장 동화",
    images: [{ url: "/phodong-og.png", width: 1536, height: 1024 }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><head><link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" /><link href="https://fonts.googleapis.com/css2?family=Gaegu:wght@700&family=Jua&display=swap" rel="stylesheet" /></head><body>{children}</body></html>;
}

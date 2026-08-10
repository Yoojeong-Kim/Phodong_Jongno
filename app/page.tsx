"use client";

import { useMemo, useRef, useState } from "react";

const genres = ["전래동화", "판타지", "히어로", "마법", "일상", "자동차", "공주·왕자", "추리", "우주", "로봇", "동물", "공룡"];
const objects = [
  { emoji: "🛋️", name: "소파", role: "지혜로운 안내자" },
  { emoji: "🧸", name: "곰인형", role: "용감한 친구" },
  { emoji: "📚", name: "책", role: "비밀을 아는 마법사" },
  { emoji: "🌵", name: "선인장", role: "숲의 수호자" },
  { emoji: "🎈", name: "풍선", role: "하늘 탐험가" },
];
const stories: Record<string, string> = {
  전래동화: "옛날 옛적, 마음씨 따뜻한 아이가 말을 할 줄 아는 {object}을 만났어요. {object}은 오래된 마을의 빛을 되찾으려면 작은 용기가 필요하다고 말했지요.",
  판타지: "창문 너머 별빛이 반짝이던 밤, {object}이 조용히 눈을 떴어요. 아이와 {object}은 구름 문을 지나 잃어버린 달 조각을 찾으러 떠났답니다.",
  히어로: "평화로운 오후, 동네의 모든 색이 갑자기 사라졌어요. 아이와 특별한 힘을 가진 {object}은 서로를 믿으며 색깔 도둑을 찾아 나섰어요.",
  마법: "아이의 손끝이 {object}에 닿자 작은 별가루가 피어올랐어요. 오늘 안에 세 가지 친절을 찾으면 비밀의 마법 정원이 열린대요.",
  일상: "비가 톡톡 내리는 아침, 아이는 {object}과 집 안 탐험을 시작했어요. 평범해 보이던 방마다 재미있는 발견과 새로운 질문이 숨어 있었답니다.",
  자동차: "부릉부릉! {object}이 세상에서 가장 작은 자동차로 변했어요. 아이는 안전벨트를 매고 무지개 도로의 도움이 필요한 친구들을 만나러 출발했어요.",
  "공주·왕자": "꽃잎 궁전의 축제를 앞둔 날, 아이와 {object}에게 중요한 초대장이 도착했어요. 가장 멋진 왕관은 보석이 아니라 다정한 마음으로 완성된대요.",
  추리: "방 안에서 쿠키 향기만 남기고 보물 상자가 사라졌어요. 꼬마 탐정과 {object}은 작은 발자국과 반짝이는 실마리를 하나씩 살펴보기 시작했어요.",
  우주: "별 지도에 없던 행성에서 구조 신호가 도착했어요. 아이와 우주 대원 {object}은 호기심 로켓을 타고 낯선 친구를 만나러 날아갔답니다.",
  로봇: "어느 날 {object}에서 조그만 로봇의 목소리가 들렸어요. 아이는 감정을 배우고 싶은 로봇과 함께 웃음, 용기, 배려의 뜻을 찾아 나섰어요.",
  동물: "숲속 친구들이 아끼던 노래를 잊어버렸어요. 아이와 {object}은 새와 토끼, 다람쥐의 소리를 모아 숲의 노래를 다시 만들기로 했어요.",
  공룡: "책장 뒤 비밀문을 열자 아기 공룡이 기다리고 있었어요. 아이와 {object}은 길을 잃은 공룡을 가족에게 데려다주기 위해 거대한 발자국을 따라갔어요.",
};

export default function Home() {
  const [genre, setGenre] = useState("판타지");
  const [objectName, setObjectName] = useState("곰인형");
  const [generated, setGenerated] = useState(false);
  const storyRef = useRef<HTMLElement>(null);
  const selectedObject = useMemo(() => objects.find((item) => item.name === objectName) ?? objects[1], [objectName]);
  const story = stories[genre].replaceAll("{object}", selectedObject.name);
  function makeStory() {
    setGenerated(true);
    window.setTimeout(() => storyRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }
  return (
    <main>
      <header className="topbar"><img src="/phodong-logo.png" alt="포동" /><span>사진 속 발견이 이야기로 이어지는 순간</span></header>
      <section className="hero">
        <div className="hero-copy"><p className="eyebrow">PHODONG STORY LAB</p><h1>우리 집 물건 하나로<br />오늘의 동화를 만나보세요.</h1><p>아이가 좋아하는 장르와 눈앞의 사물을 고르면, 포동이 상상력 가득한 이야기의 첫 장을 열어드려요.</p><a href="#experience" className="primary-link">바로 체험하기 <span>↓</span></a></div>
        <div className="hero-image"><img src="/phodong-hero.webp" alt="아이와 부모가 포동 그림책을 함께 보는 모습" /></div>
      </section>
      <section className="experience" id="experience">
        <div className="section-title"><span>3분 미리 체험</span><h2>어떤 이야기를 만들어볼까요?</h2><p>두 가지만 고르면 포동이 이야기의 시작을 들려줘요.</p></div>
        <div className="steps">
          <article className="choice-card"><div className="step-label"><b>1</b><span>좋아하는 이야기 장르</span></div><div className="genre-grid">{genres.map((item) => <button key={item} className={genre === item ? "selected" : ""} onClick={() => { setGenre(item); setGenerated(false); }}>{item}</button>)}</div></article>
          <article className="choice-card"><div className="step-label"><b>2</b><span>오늘 이야기의 주인공</span></div><div className="object-grid">{objects.map((item) => <button key={item.name} className={objectName === item.name ? "selected" : ""} onClick={() => { setObjectName(item.name); setGenerated(false); }} aria-label={`${item.name}, ${item.role}`}><span>{item.emoji}</span><strong>{item.name}</strong><small>{item.role}</small></button>)}</div></article>
        </div>
        <button className="generate" onClick={makeStory}>포동 이야기 만들기 <span>✦</span></button>
      </section>
      <section ref={storyRef} className={`story-result ${generated ? "show" : ""}`} aria-live="polite">
        <div className="book-cover"><img src="/phodong-book.webp" alt="포동 맞춤 그림책" /></div>
        <div className="story-copy"><p className="eyebrow">YOUR PHODONG STORY</p><span className="story-tag">{genre} · {selectedObject.role}</span><h2>{selectedObject.emoji} {selectedObject.name}과 별빛 모험</h2><p>{story}</p><div className="story-note">이 이야기는 체험용 미리보기예요. 실제 포동에서는 아이가 찍은 사진과 선택한 배움 주제로 더 풍성한 맞춤 동화가 만들어집니다.</div><button onClick={() => { setGenerated(false); document.getElementById("experience")?.scrollIntoView({ behavior: "smooth" }); }}>다시 만들어보기</button></div>
      </section>
      <section className="promise"><p>PHOTO · DISCOVER · LEARN · STORY</p><h2>아이의 하루는 이미<br />멋진 이야기로 가득해요.</h2><span>포동은 평범한 발견을 관찰과 배움, 오래 간직할 이야기로 이어줍니다.</span></section>
      <footer><img src="/phodong-logo.png" alt="포동" /><p>아이의 발견이 배움이 되는 맞춤동화</p><small>© 2026 PHODONG</small></footer>
    </main>
  );
}

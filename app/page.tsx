"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";

const greetings: Record<string, string> = {
  "안녕하세요": "안녕하세요", "Hello": "Hello", "Xin chào": "Xin chào", "Salam": "Salam", "สวัสดี": "สวัสดี", "Привет": "Привет", "你好": "你好", "こんにちは": "こんにちは",
};

export default function Home() {
  const [photo, setPhoto] = useState("");
  const [childName, setChildName] = useState("");
  const [objectName, setObjectName] = useState("");
  const [meaning, setMeaning] = useState("");
  const [greeting, setGreeting] = useState("안녕하세요");
  const [storyReady, setStoryReady] = useState(false);
  const storyRef = useRef<HTMLElement>(null);

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo); }, [photo]);

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (photo) URL.revokeObjectURL(photo);
    setPhoto(URL.createObjectURL(file));
    setStoryReady(false);
  }

  function makeStory() {
    if (!photo || !childName.trim() || !objectName.trim() || !meaning.trim()) return;
    setStoryReady(true);
    window.setTimeout(() => storyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  const name = childName.trim() || "우리 친구";
  const object = objectName.trim() || "소중한 물건";
  const familyMeaning = meaning.trim() || "우리 가족의 따뜻한 마음";

  return (
    <main>
      <header className="topbar"><img src="/phodong-logo.png" alt="포동" /><span className="event-badge">오늘만 열리는 이야기 놀이터!</span></header>

      <section className="hero" style={{ gridTemplateColumns: "1fr", minHeight: 620 }}>
        <div className="hero-copy" style={{ width: "min(1120px, 100%)", margin: "auto", textAlign: "center" }}>
          <p className="eyebrow">PHODONG TOGETHER DAY</p>
          <h1>찰칵! 우리 가족의 물건이<br /><em>세상에 하나뿐인 동화</em>가 돼요.</h1>
          <p style={{ marginLeft: "auto", marginRight: "auto" }}>각자 가져온 소중한 물건에는 서로 다른 가족과 문화의 이야기가 숨어 있어요. 사진을 찍고, 친구들에게 소개하고, 다 함께 재미있는 동화를 만들어봐요!</p>
          <a className="primary-link" href="#play">지금 같이 놀기 <span>→</span></a>
        </div>
      </section>

      <section className="bring">
        <div className="bring-title"><span>오늘의 준비물</span><h2>우리 가족을 떠올리게 하는 물건 하나</h2></div>
        <div className="bring-list"><article><b>🧸</b><span>오래 함께한<br />장난감</span></article><article><b>🎁</b><span>가족에게 받은<br />선물</span></article><article><b>🪆</b><span>우리 문화가 담긴<br />소품</span></article><article><b>🥄</b><span>함께 쓰는<br />생활 물건</span></article><article><b>💛</b><span>나에게 특별한<br />어떤 것이든!</span></article></div>
      </section>

      <section className="play" id="play">
        <div className="section-heading"><p className="eyebrow">LET'S MAKE A STORY</p><h2>사진 한 장으로 동화 만들기</h2><p>친구와 함께 천천히 세 칸을 채워보세요.</p></div>
        <div className="maker">
          <div className={`upload-zone ${photo ? "has-photo" : ""}`}>
            <input id="photo" type="file" accept="image/*" capture="environment" onChange={choosePhoto} />
            <label htmlFor="photo">
              {photo ? <img src={photo} alt="업로드한 가족 상징 물건" /> : <><b>📸</b><strong>물건 사진 찍기</strong><span>카메라로 찍거나 사진을 골라요</span></>}
              {photo && <em>사진 다시 고르기</em>}
            </label>
          </div>
          <div className="story-form">
            <label><span><b>1</b> 내 이름</span><input value={childName} onChange={(e) => { setChildName(e.target.value); setStoryReady(false); }} placeholder="예: 지우" maxLength={20} /></label>
            <label><span><b>2</b> 이 물건의 이름</span><input value={objectName} onChange={(e) => { setObjectName(e.target.value); setStoryReady(false); }} placeholder="예: 할머니가 주신 인형" maxLength={40} /></label>
            <label><span><b>3</b> 우리 가족에게 왜 특별한가요?</span><textarea value={meaning} onChange={(e) => { setMeaning(e.target.value); setStoryReady(false); }} placeholder="예: 베트남에 계신 할머니가 보내주셨어요." maxLength={120} /></label>
            <label><span><b>+</b> 이야기 속 첫인사</span><select value={greeting} onChange={(e) => { setGreeting(e.target.value); setStoryReady(false); }}>{Object.keys(greetings).map((item) => <option key={item}>{item}</option>)}</select></label>
            <button className="make-button" disabled={!photo || !childName.trim() || !objectName.trim() || !meaning.trim()} onClick={makeStory}>나만의 동화 만들기 <span>✨</span></button>
            <small>사진은 이 화면에서만 사용되며 서버에 저장되지 않아요.</small>
          </div>
        </div>
      </section>

      <section ref={storyRef} className={`story-result ${storyReady ? "show" : ""}`} aria-live="polite">
        <div className="book-photo">{photo && <img src={photo} alt={`${object} 사진`} />}<span>MY FAMILY STORY</span></div>
        <div className="story-copy">
          <p className="eyebrow">세상에 하나뿐인 이야기</p><h2>{name}와 {object}의<br />무지개 여행</h2>
          <p><strong>“{greetings[greeting]}!”</strong> 어느 즐거운 날, {name}가 {object}에게 인사를 건넸어요. 그러자 물건에서 알록달록한 빛이 피어나며 가족의 추억으로 가는 문이 열렸답니다.</p>
          <p>{object}은 {familyMeaning}을 기억하고 있었어요. 둘은 그 소중한 마음을 친구들에게 나누기 위해 서로 다른 말과 노래, 맛있는 음식과 반짝이는 색깔이 가득한 마을로 모험을 떠났어요.</p>
          <p>친구들은 생김새와 말이 달라도 서로의 이야기를 귀 기울여 들었어요. 그 순간 모두의 빛이 모여 커다란 무지개가 되었답니다. “우리 가족의 이야기는 모두 특별해!”</p>
          <div className="story-actions"><button onClick={() => window.print()}>동화 간직하기</button><button onClick={() => { setStoryReady(false); document.getElementById("play")?.scrollIntoView({ behavior: "smooth" }); }}>다시 만들기</button></div>
        </div>
      </section>

      <section className="together"><p>ONE PHOTO, MANY CULTURES, OUR STORY</p><h2>다른 모습, 다른 이야기,<br />그래서 더 신나는 우리!</h2><span>친구의 물건과 가족 이야기를 함께 듣고 서로의 특별함을 발견해요.</span></section>
      <footer><img src="/phodong-logo.png" alt="포동" /><p>다 같이 만드는 오늘의 이야기 놀이터</p><small>© 2026 PHODONG</small></footer>
    </main>
  );
}

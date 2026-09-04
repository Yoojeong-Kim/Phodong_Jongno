"use client";
import {PointerEvent,useRef,useState} from "react";

export type StoryPage={page:number;title:string;text:string;image_prompt:string;image_url?:string};
export type Sticker={id:string;src:string;page:number;x:number;y:number;size:number};
export type Point={x:number;y:number};
export type Stroke={id:string;page:number;color:string;width:number;points:Point[]};
export type Decoration={stickers:Sticker[];drawings:Stroke[]};
export type StoryData={id:string;child_name:string;genre:string;object_name:string;title:string;summary:string;pages:StoryPage[];stickers?:Sticker[];drawings?:Stroke[]};
const stickerSources=Array.from({length:9},(_,i)=>`/stickers/sticker-${String(i+1).padStart(2,"0")}.png`);
const colors=["#ef5f89","#ff9f43","#ffd43b","#57b77a","#4d91e8","#7558c9","#3d2940"];

function BookPage({story,page}:{story:StoryData;page:number}){const p=story.pages[page];return <><div className="visual">{p.image_url?<img src={p.image_url} alt={`${p.title} 삽화`}/>:<div className="image-wait">삽화를 불러오고 있어</div>}<span>{page+1} / {story.pages.length}</span></div><article><small>{story.child_name}의 {story.genre} 동화</small><h2>{page===0?story.title:p.title}</h2><p>{p.text}</p></article></>}

export function ReaderBook({story,onSave,onDecorate,isFromGallery}:{story:StoryData;onSave:()=>void;onDecorate?:()=>void;isFromGallery?:boolean}){
 const [page,setPage]=useState(0),[turning,setTurning]=useState<"next"|"prev"|null>(null),touch=useRef(0);
 function turn(n:number){if(n<0||n>=story.pages.length||n===page||turning)return;setTurning(n>page?"next":"prev");setPage(n);setTimeout(()=>setTurning(null),480)}
 const pageStrokes=(story.drawings||[]).filter(s=>s.page===page),pageStickers=(story.stickers||[]).filter(s=>s.page===page);
 return <section className="screen story reader">
  <div className={`book ${turning?`turn-${turning}`:""}`} onTouchStart={e=>touch.current=e.touches[0].clientX} onTouchEnd={e=>{const d=e.changedTouches[0].clientX-touch.current;if(Math.abs(d)>55)turn(page+(d>0?-1:1))}}>
   {isFromGallery&&onDecorate&&<button className="gallery-decorate-badge" onClick={onDecorate}>🎨 이 동화 꾸미기</button>}
   <BookPage story={story} page={page}/>
   <svg className="drawing-layer reader-drawings" viewBox="0 0 100 100" preserveAspectRatio="none" style={{pointerEvents:"none"}}>{pageStrokes.map(s=><polyline key={s.id} points={s.points.map(p=>`${p.x},${p.y}`).join(" ")} fill="none" stroke={s.color} strokeWidth={s.width/2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>)}</svg>
   {pageStickers.map(s=><div key={s.id} className="placed-sticker" style={{left:`${s.x}%`,top:`${s.y}%`,width:s.size,pointerEvents:"none"}}><img src={s.src} alt="붙인 포동이 스티커" draggable={false}/></div>)}
   <nav className="book-nav">
    <button disabled={page===0} onClick={()=>turn(page-1)}>앞 페이지</button>
    <div>{story.pages.map((_,i)=><button key={i} className={page===i?"on":""} onClick={()=>turn(i)} aria-label={`${i+1}쪽`}/>)}</div>
    {page<story.pages.length-1?<button onClick={()=>turn(page+1)}>다음 페이지</button>:isFromGallery?(onDecorate?<button className="save-story" onClick={onDecorate}>🎨 꾸미러 가기</button>:<button className="save-story" onClick={onSave}>책장으로</button>):<button className="save-story" onClick={onSave}>동화 저장하기</button>}
   </nav>
  </div>
  <style>{styles}</style>
 </section>
}

export function DecorateBook({story,finish}:{story:StoryData;finish:(d:Decoration)=>Promise<void>}){const [page,setPage]=useState(0),[mode,setMode]=useState<"pen"|"sticker">("pen"),[stickers,setStickers]=useState<Sticker[]>(story.stickers||[]),[drawings,setDrawings]=useState<Stroke[]>(story.drawings||[]),[selected,setSelected]=useState(""),[color,setColor]=useState(colors[0]),[width,setWidth]=useState(7),[ghost,setGhost]=useState<{src:string;x:number;y:number}|null>(null),[saving,setSaving]=useState(false),bookRef=useRef<HTMLDivElement>(null),drawing=useRef<Stroke|null>(null);
 function pos(e:PointerEvent){const r=bookRef.current?.getBoundingClientRect();if(!r)return null;return {x:Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100)),y:Math.max(0,Math.min(100,(e.clientY-r.top)/r.height*100)),inside:e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom}}
 function penStart(e:PointerEvent<SVGSVGElement>){if(mode!=="pen")return;e.currentTarget.setPointerCapture(e.pointerId);const p=pos(e);if(!p)return;drawing.current={id:crypto.randomUUID(),page,color,width,points:[p]};setDrawings(v=>[...v,drawing.current!])}
 function penMove(e:PointerEvent<SVGSVGElement>){if(!drawing.current||!e.currentTarget.hasPointerCapture(e.pointerId))return;const p=pos(e);if(!p)return;drawing.current={...drawing.current,points:[...drawing.current.points,p]};const next=drawing.current;setDrawings(v=>v.map(s=>s.id===next!.id?next!:s))}
 function penEnd(){drawing.current=null}
 function startNew(e:PointerEvent<HTMLButtonElement>,src:string){e.currentTarget.setPointerCapture(e.pointerId);setGhost({src,x:e.clientX,y:e.clientY})}
 function moveNew(e:PointerEvent){if(ghost)setGhost(v=>v&&({...v,x:e.clientX,y:e.clientY}))}
 function endNew(e:PointerEvent,src:string){const p=pos(e);setGhost(null);if(p?.inside){const id=crypto.randomUUID();setStickers(v=>[...v,{id,src,page,x:p.x,y:p.y,size:112}]);setSelected(id)}}
 function moveSticker(e:PointerEvent<HTMLButtonElement>,id:string){if(!e.currentTarget.hasPointerCapture(e.pointerId))return;const p=pos(e);if(p)setStickers(v=>v.map(s=>s.id===id?{...s,x:p.x,y:p.y}:s))}
 const pageStrokes=drawings.filter(s=>s.page===page),pageStickers=stickers.filter(s=>s.page===page);
 return <section className="screen story decorator"><div className="decorate-head"><div><small>포동이의 동화책장 🎨</small><h2>내 동화책을 마음껏 꾸며 봐</h2></div><div className="mode-tabs"><button className={mode==="pen"?"on":""} onClick={()=>{setMode("pen");setSelected("")}}>✏️ 펜으로 그리기</button><button className={mode==="sticker"?"on":""} onClick={()=>setMode("sticker")}>🌟 스티커 붙이기</button></div></div>{mode==="pen"?<div className="pen-tools">{colors.map(c=><button key={c} className={color===c?"on":""} style={{background:c}} onClick={()=>setColor(c)} aria-label={`${c} 색상`}/>)}<button className={width===4?"on":""} onClick={()=>setWidth(4)}>가는 펜</button><button className={width===7?"on":""} onClick={()=>setWidth(7)}>보통 펜</button><button className={width===12?"on":""} onClick={()=>setWidth(12)}>굵은 펜</button><button onClick={()=>setDrawings(v=>v.filter(s=>s.page!==page))}>이 페이지 지우기</button></div>:<div className="sticker-tray">{stickerSources.map((src,i)=><button key={src} aria-label={`${i+1}번째 스티커`} onPointerDown={e=>startNew(e,src)} onPointerMove={moveNew} onPointerUp={e=>endNew(e,src)}><img src={src} alt="" draggable={false}/></button>)}</div>}
 <div ref={bookRef} className="book decorate-canvas" onPointerDown={()=>selected&&setSelected("")}><BookPage story={story} page={page}/><svg className={`drawing-layer ${mode==="pen"?"active":""}`} viewBox="0 0 100 100" preserveAspectRatio="none" onPointerDown={penStart} onPointerMove={penMove} onPointerUp={penEnd} onPointerCancel={penEnd}>{pageStrokes.map(s=><polyline key={s.id} points={s.points.map(p=>`${p.x},${p.y}`).join(" ")} fill="none" stroke={s.color} strokeWidth={s.width/7} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>)}</svg>{pageStickers.map(s=><button key={s.id} className={`placed-sticker ${selected===s.id?"selected":""}`} style={{left:`${s.x}%`,top:`${s.y}%`,width:s.size}} onPointerDown={e=>{e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);setSelected(s.id)}} onPointerMove={e=>moveSticker(e,s.id)}><img src={s.src} alt="붙인 포동이 스티커" draggable={false}/></button>)}</div>
 <div className="decorate-footer"><button disabled={page===0} onClick={()=>{setPage(v=>v-1);setSelected("")}}>← 앞 페이지</button><strong>{page+1} / {story.pages.length}</strong>{page<story.pages.length-1?<button onClick={()=>{setPage(v=>v+1);setSelected("")}}>다음 페이지 →</button>:<button className="finish" disabled={saving} onClick={async()=>{setSaving(true);await finish({stickers,drawings});setSaving(false)}}>{saving?"저장 중…":"꾸미기 완료! 책장으로"}</button>}</div>{selected&&<div className="sticker-tools"><button onClick={()=>setStickers(v=>v.map(s=>s.id===selected?{...s,size:Math.max(70,s.size-18)}:s))}>작게</button><button onClick={()=>setStickers(v=>v.map(s=>s.id===selected?{...s,size:Math.min(220,s.size+18)}:s))}>크게</button><button onClick={()=>{setStickers(v=>v.filter(s=>s.id!==selected));setSelected("")}}>떼기</button></div>}{ghost&&<img className="sticker-ghost" src={ghost.src} style={{left:ghost.x,top:ghost.y}} alt=""/>}<style>{styles}</style></section>}

const styles=`
.reader{padding:clamp(10px,1.6vw,20px) clamp(10px,2vw,24px)!important;display:flex;align-items:center;justify-content:center}
.reader .book{width:min(1420px,97vw);max-width:97vw;height:clamp(550px,calc(100svh - 180px),780px);min-height:0;margin:auto;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);position:relative;border-radius:28px;overflow:hidden;box-shadow:0 30px 85px rgba(61,41,64,0.18)}
.gallery-decorate-badge{position:absolute;right:22px;top:18px;z-index:12;border:0;background:linear-gradient(145deg,#fff0f5,#ffe2ec);color:#cf3468;font-weight:700;font-size:14px;padding:9px 16px;border-radius:99px;box-shadow:0 4px 14px rgba(207,52,104,0.18);border:1px solid #ffd1e0;cursor:pointer;transition:transform .18s ease}
.gallery-decorate-badge:hover{transform:translateY(-2px)}
.reader .book .visual{height:100%;position:relative;background:linear-gradient(145deg,#f5d6df,#eebaca)}
.reader .book .visual img{width:100%;height:100%;object-fit:cover;display:block}
.reader .book article{padding:clamp(24px,3.5vw,48px) clamp(28px,4vw,56px) 80px;display:flex;flex-direction:column;justify-content:center;overflow:visible!important}
.reader .book article>small{font-size:clamp(13px,1.4vw,16px);font-weight:700;color:#f55f91;margin-bottom:6px;display:block}
.reader .book article h2{font-size:clamp(20px,2.4vw,30px);margin:6px 0 16px;line-height:1.35;letter-spacing:-.03em;font-weight:700;color:#3d2940}
.reader .book article p{font-size:clamp(18px,1.8vw,22px);line-height:1.85;color:#432e3a;max-height:none!important;overflow:visible!important;word-break:keep-all;word-wrap:break-word;margin:0}
.book-nav{position:absolute;z-index:8;left:calc(46% + 16px);right:24px;bottom:18px;display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center}
.book-nav>button,.decorate-footer button{border:0;background:#f9e7ed;padding:10px 18px;border-radius:99px;font-size:15px;font-weight:600;color:#4d3442}
.book-nav>button:disabled,.decorate-footer button:disabled{opacity:.35}
.book-nav>div{display:flex;justify-content:center;gap:7px}
.book-nav>div button{width:9px;height:9px;padding:0;border:0;border-radius:50%;background:#e8c7d1}
.book-nav>div button.on{background:#f55f91}
.save-story,.finish{background:linear-gradient(145deg,#ff789f,#e94b7f)!important;color:#fff!important;box-shadow:0 6px 18px rgba(233,75,127,0.35)!important}
.decorate-head{max-width:1180px;margin:0 auto 12px;display:flex;justify-content:space-between;align-items:end;gap:20px}
.decorate-head small{color:#f55f91}
.decorate-head h2{margin:4px 0;font-size:clamp(25px,3vw,38px)}
.mode-tabs{display:flex;background:#fff;padding:5px;border-radius:16px}
.mode-tabs button{border:0;background:none;padding:11px 15px;border-radius:12px}
.mode-tabs button.on{background:#ffe5ed;color:#bd3d69;font-weight:700}
.pen-tools,.sticker-tray{max-width:1180px;margin:0 auto 12px;display:flex;align-items:center;gap:8px;overflow-x:auto;padding:9px 12px;background:#fff;border-radius:18px;box-shadow:0 10px 28px #71374b17}
.pen-tools button{flex:0 0 auto;border:1px solid #ead1da;background:#fff7fa;border-radius:99px;padding:8px 12px}
.pen-tools button[style]{width:30px;height:30px;padding:0;border:3px solid #fff;box-shadow:0 0 0 1px #ddc4cc}
.pen-tools button.on{box-shadow:0 0 0 3px #3d2940}
.sticker-tray button{width:72px;height:72px;flex:0 0 72px;border:0;background:#fff0f4;border-radius:15px;padding:4px;touch-action:none}
.sticker-tray img{width:100%;height:100%;object-fit:contain;pointer-events:none}
.decorator{padding-top:20px;overflow:visible}
.decorator .book{height:clamp(500px,calc(100svh - 300px),650px)}
.drawing-layer{position:absolute;inset:0;z-index:10;width:100%;height:100%;pointer-events:none}
.drawing-layer.active{pointer-events:auto;touch-action:none;cursor:crosshair}
.placed-sticker{position:absolute;z-index:12;transform:translate(-50%,-50%);padding:0;border:0;background:none;touch-action:none;filter:drop-shadow(0 5px 5px #5e354b3d)}
.placed-sticker img{display:block;width:100%;height:auto;pointer-events:none}
.placed-sticker.selected{outline:3px dashed #ff5f91;outline-offset:5px;border-radius:12px}
.sticker-tools{position:sticky;z-index:20;bottom:12px;margin:8px auto 0;width:max-content;display:flex;gap:6px;background:#3d2940e8;padding:7px;border-radius:99px}
.sticker-tools button{border:0;background:#fff;border-radius:99px;padding:8px 13px}
.sticker-ghost{position:fixed;z-index:100;width:120px;max-height:150px;object-fit:contain;transform:translate(-50%,-50%);pointer-events:none}
.decorate-footer{max-width:760px;margin:14px auto 0;display:flex;justify-content:space-between;align-items:center;gap:10px}
@media(max-width:850px){
 .reader .book{grid-template-columns:1fr;grid-template-rows:44% 56%;height:calc(100svh - 220px);min-height:480px}
 .book-nav{left:16px;right:16px;bottom:14px}
 .reader .book article{padding:16px 20px 60px}
 .reader .book article h2{font-size:22px;margin:4px 0 8px}
 .reader .book article p{font-size:17px;line-height:1.65}
 .decorate-head{display:block;text-align:center}
 .mode-tabs{width:max-content;margin:10px auto}
 .decorator .book{height:calc(100svh - 335px);min-height:500px}
 .placed-sticker{max-width:25vw}
}
@media(max-width:560px){
 .reader{padding:6px 6px!important}
 .reader .book{height:calc(100svh - 200px);min-height:440px;border-radius:20px}
 .book-nav{left:10px;right:10px;bottom:8px;gap:6px}
 .book-nav>button{font-size:12px;padding:8px 12px}
 .reader .book article{padding:12px 14px 50px}
 .reader .book article h2{font-size:18px;margin:2px 0 6px}
 .reader .book article p{font-size:15px;line-height:1.55}
 .gallery-decorate-badge{top:10px;right:10px;padding:6px 12px;font-size:12px}
}
`;

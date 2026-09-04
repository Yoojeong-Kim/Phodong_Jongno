import { env } from "cloudflare:workers";
import { ensureStoryTables, openAIKey, rowToStory } from "../../../../lib/story-store";

export async function POST(req:Request){
 let lockId:string|undefined,lockPage:number|undefined,slotAcquired=false;
 try{
  await ensureStoryTables();
  const {id,page}=await req.json() as {id:string,page:number};
  lockId=id;lockPage=page;
  if(!/^[0-9a-f-]{36}$/.test(id)||!Number.isInteger(page)||page<0||page>4)return Response.json({error:"잘못된 요청이야."},{status:400});
  const row=await env.DB.prepare("SELECT * FROM stories WHERE id=?").bind(id).first();
  if(!row)return Response.json({error:"동화를 찾지 못했어."},{status:404});
  const story=rowToStory(row),target=story.pages[page];
  if(target.image_url?.includes("style-v2"))return Response.json({image_url:target.image_url,complete:story.status==="complete"});
  const key=`stories/${id}/page-${page+1}-style-v2.png`;
  const existing=await env.DB.prepare("SELECT 1 FROM story_images WHERE key=?").bind(key).first();
  if(existing){
   target.image_url=`/api/story-images/${id}/page-${page+1}-style-v2.png`;
   const complete=story.pages.every(p=>p.image_url?.includes("style-v2"));
   await env.DB.prepare("UPDATE stories SET pages_json=?, status=? WHERE id=?").bind(JSON.stringify(story.pages),complete?"complete":"generating",id).run();
   return Response.json({image_url:target.image_url,complete});
  }
  const slot=await env.DB.prepare(`UPDATE image_slots SET story_id=?,page=?,locked_until=? WHERE slot=(SELECT slot FROM image_slots WHERE locked_until<? ORDER BY slot LIMIT 1) RETURNING slot`).bind(id,page,Date.now()+240000,Date.now()).first<{slot:number}>();
  if(!slot)return Response.json({queued:true},{status:202});
  slotAcquired=true;
  const phodongIncluded=/포동이/.test(target.image_prompt)&&!/등장하지|제외|없음/.test(target.image_prompt);
  const phodongRule=phodongIncluded?"포동이가 명시된 장면에서는 포동이의 얼굴, 귀, 눈, 주둥이, 체형, 털색, 목 스카프를 1페이지와 동일하게 유지한다.":"포동이와 모든 곰·곰돌이 캐릭터는 등장시키지 않는다. 첨부 스타일 기준 이미지에 곰이 있더라도 그림체와 재질만 참고하고 곰 캐릭터는 복사하지 않는다.";
  const sceneRules=["넓은 도입 전경과 새로운 장소를 보여 주고, 인물들은 서로 다른 방향을 바라보며 발견하는 자세","이동감이 느껴지는 역동적인 측면 구도, 서로 다른 걷기·달리기·손짓과 생생한 표정","낮거나 기울어진 카메라 시점의 긴장 장면, 문제를 마주한 서로 다른 표정과 행동","가까운 행동 중심 구도, 손과 물건을 활용해 각자 다른 방식으로 문제를 해결하는 순간","따뜻한 빛의 넓은 마무리 장면, 안도와 기쁨이 드러나는 자연스러운 자세와 풍부한 배경"];
  const prompt=`장면 ${page+1}/5: ${target.image_prompt}\n\n이번 페이지 변화 규칙: ${sceneRules[page]}. 직전 페이지와 같은 장소, 정면 단체 포즈, 카메라 거리, 표정, 조명을 반복하지 않는다. 캐릭터 모델은 유지하되 장면 연출은 확연히 달라야 한다.\n\n첨부 이미지는 화풍과 캐릭터 일관성의 시각 기준이다. 같은 제작사, 같은 3D 렌더러, 같은 캐릭터 모델 시트로 만든 한 권의 동화처럼 보여야 한다. 기준 이미지의 밝고 화사한 복숭아·블러시 핑크·크림 팔레트, 깨끗한 흰색 기준점, 포근한 니트와 머리카락의 미세한 촉감, 둥글고 친근한 얼굴 비율, 맑고 반짝이는 눈, 생기 있는 볼, 고급 장편 애니메이션 수준의 정교한 3D 렌더링을 유지한다.\n\n캐릭터·물건 잠금: ${phodongRule} image_prompt에 적힌 모든 주인공의 얼굴형, 머리 길이·모양·색, 체형, 옷의 색·무늬, 소품과 고유 표식을 1페이지와 완전히 동일하게 유지하고 서로 바꾸지 않는다. 다음 모든 물건 '${story.object_name}'의 색·형태·재질·크기를 유지한다. 다섯 페이지 전체에서 인물과 물건의 등장 비중을 균형 있게 맞추되 매 페이지 모두를 똑같이 일렬 배치하지 않는다.\n\n금지: 요청하지 않은 곰 캐릭터, 주인공 외형 혼합, 이전 페이지와 같은 포즈·표정·배경·정면 단체 구도 반복, 탁한 갈색 또는 회색 필터, 어두운 노출, 공포 분위기, 날카로운 그림자, 기괴한 손, 저채도, 빈티지 세피아, 값싼 플라스틱, 다른 화풍, 실사 인물, 텍스트, 자막, 로고, 워터마크.`;
   const PHODONG_DESC="포동이 외형: 통통하고 복슬복슬한 복숭아 베이지색 곰돌이. 분홍 발바닥, 분홍 볼터치, 반짝이는 검은 구슬 눈, 작고 귀여운 코. 크림색 니트 스웨터, 분홍·살몬 나비매듭 스카프. 이 모습을 5페이지 내내 정확히 유지한다.";
   let response:Response;
   if(page>0){
    const firstRow=await env.DB.prepare("SELECT b64 FROM story_images WHERE key=?").bind(`stories/${id}/page-1-style-v2.png`).first<{b64:string}>();
    if(!firstRow?.b64)return Response.json({error:"첫 번째 그림부터 다시 만들어 줘."},{status:409});
    const bin=atob(firstRow.b64);
    const refU8=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++){refU8[i]=bin.charCodeAt(i);}
    const form=new FormData();form.append("model","gpt-image-1");form.append("prompt",phodongIncluded?`${prompt}\n\n${PHODONG_DESC}`:prompt);form.append("size","1024x1024");form.append("quality","medium");form.append("output_format","png");form.append("image",new Blob([refU8.buffer],{type:"image/png"}),"page-one-character-reference.png");
    response=await fetch("https://api.openai.com/v1/images/edits",{method:"POST",headers:{Authorization:`Bearer ${openAIKey()}`},body:form});
   }else{
    const refUrl="https://raw.githubusercontent.com/Yoojeong-Kim/Phodong_Jongno/main/public/story-style-reference-v1.png";
    const styleRes=await fetch(refUrl);
    if(styleRes.ok){
     const refBytes=await styleRes.arrayBuffer();
     const form=new FormData();form.append("model","gpt-image-1");form.append("prompt",phodongIncluded?`${prompt}\n\n${PHODONG_DESC}`:prompt);form.append("size","1024x1024");form.append("quality","medium");form.append("output_format","png");form.append("image",new Blob([refBytes],{type:"image/jpeg"}),"style-reference.jpg");
     response=await fetch("https://api.openai.com/v1/images/edits",{method:"POST",headers:{Authorization:`Bearer ${openAIKey()}`},body:form});
    }else{
     console.warn("style_ref_fetch_failed",styleRes.status);
     response=await fetch("https://api.openai.com/v1/images/generations",{method:"POST",headers:{Authorization:`Bearer ${openAIKey()}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-image-1",prompt:phodongIncluded?`${prompt}\n\n${PHODONG_DESC}`:prompt,size:"1024x1024",quality:"medium",output_format:"png"})});
    }
   }
   if(!response.ok){const detail=await response.text();console.error("image_api",response.status,detail.slice(0,500));throw new Error(`이미지 API 오류 ${response.status}`)}
   const data=await response.json() as any,b64=data.data?.[0]?.b64_json;if(!b64)throw new Error("이미지 데이터 없음");
  await env.DB.prepare("INSERT INTO story_images (key,b64,created_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET b64=excluded.b64").bind(key,b64,Date.now()).run();
  target.image_url=`/api/story-images/${id}/page-${page+1}-style-v2.png`;
  const complete=story.pages.every(p=>p.image_url?.includes("style-v2"));
  await env.DB.prepare("UPDATE stories SET pages_json=?, status=? WHERE id=?").bind(JSON.stringify(story.pages),complete?"complete":"generating",id).run();
  return Response.json({image_url:target.image_url,complete});
 }catch(e){console.error("image_gen_failed",e instanceof Error?e.message:String(e));return Response.json({error:"삽화를 만드는 데 실패했어."},{status:500})}
 finally{try{if(slotAcquired&&lockId&&Number.isInteger(lockPage))await env.DB.prepare("UPDATE image_slots SET story_id=NULL,page=NULL,locked_until=0 WHERE story_id=? AND page=?").bind(lockId,lockPage).run()}catch{}}
}

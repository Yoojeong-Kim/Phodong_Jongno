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
  const sceneRules=["넓은 도입 전경과 새로운 장소를 보여 주고, 인물들은 서로 다른 방향을 바라보며 발견하는 자세","이동감이 느껴지는 역동적인 측면 구도, 서로 다른 걷기·달리기·손짓과 생생한 표정","낮거나 기울어진 카메라 시점의 긴장 장면, 문제를 마주한 서로 다른 표정과 행동","가까운 행동 중심 구도, 손과 물건을 활용해 각자 다른 방식으로 문제를 해결하는 순간","따뜻한 빛의 넓은 마무리 장면, 안도와 기쁨이 드러나는 자연스러운 자세와 풍부한 배경"];

  const STYLE="그림체: 프리미엄 시네마틱 3D 동화책 일러스트. 부드럽고 포근한 클레이·플러시 벨벳 질감의 캐릭터. 복숭아·블러시 핑크·아이보리 크림 파스텔 팔레트, 밝고 따뜻한 배경. 마법 같은 포근한 빛과 반짝이는 보케·글리터 이펙트. 캐릭터는 둥글고 친근한 얼굴 비율, 크고 맑게 반짝이는 눈, 발그레한 볼, 부드러운 피부와 머릿결 질감. 픽사·일루미네이션 스튜디오 수준 4K 정교한 3D 렌더링. 텍스트·자막·로고·워터마크 절대 금지.";
  const PHODONG="포동이 외형 고정: 통통하고 복슬복슬한 복숭아 베이지색 곰돌이. 분홍 발바닥 패드, 분홍 볼터치, 반짝이는 검은 구슬 눈, 작고 귀여운 검은 코. 크림색 니트 스웨터, 분홍·살몬 나비매듭 스카프. 이 외형을 5페이지 내내 정확히 유지.";
  const noPhodong="포동이·곰·곰돌이 캐릭터는 이야기와 삽화 어디에도 절대 등장하지 않는다.";

  const scenePrompt=`장면 ${page+1}/5: ${target.image_prompt}\n\n연출 규칙: ${sceneRules[page]}. 이전 페이지와 같은 장소·포즈·구도·조명을 반복하지 않는다. 캐릭터 외형은 유지하되 장면 연출은 확연히 달라야 한다.\n\n캐릭터 외형 잠금: image_prompt에 적힌 모든 주인공의 얼굴형·머리 길이·색·체형·옷 색·소품을 5페이지 내내 동일하게 유지한다. 물건 '${story.object_name}'의 색·형태·재질·크기를 유지한다.\n\n${phodongIncluded?PHODONG:noPhodong}\n\n${STYLE}\n\n절대 금지: 주인공 외형 혼합, 기괴한 손, 실사 인물, 텍스트·자막·로고·워터마크.`;

  const response=await fetch("https://api.openai.com/v1/images/generations",{method:"POST",headers:{Authorization:`Bearer ${openAIKey()}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-image-1",prompt:scenePrompt,size:"1024x1024",quality:"high",output_format:"png"})});
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

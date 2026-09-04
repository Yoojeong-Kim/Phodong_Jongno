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

  const STYLE="Art Style: Masterpiece 3D cinematic CGI storybook illustration, adorable Pixar/Disney Animation Studios aesthetic. Extremely high detail, soft tactile textures, cozy clay and plush velvet feel. Warm glowing peach, dusty rose pink, cream and honey pastel palette. Volumetric dreamy sunlight, subtle sparkling magical floating dust particles, gentle lens bokeh. Characters have big glossy expressive dark eyes, rosy blushed cheeks, joyful heartwarming smile, soft detailed knitted woolen sweaters and cozy outfits. Ultra-clean render, award-winning picture book art, no photorealism, no ugly deformed anatomy, absolutely no text, letters, watermarks or subtitles.";
  const PHODONG="포동이 외형: 포동이는 통통하고 포근한 꿀베이지색 봉제인형 곰돌이 캐릭터. 복슬복슬한 털 질감, 둥글둥글한 귀, 작고 까만 단추 눈과 코, 발그레한 살구빛 볼, 손발바닥의 핑크 젤리 패드. 포근한 아이보리 꽈배기 니트 스웨터와 사랑스러운 코랄 핑크 스카프를 매고 있음.";
  const noPhodong="포동이 및 곰·테디베어 캐릭터는 일체 등장시키지 말 것.";

  const scenePrompt=`[3D Storybook Illustration - Genre: ${story.genre}]\n\n[Scene ${page+1}/5 - Story & Action]:\n${target.text}\n\n[Visual Details & Key Subjects]:\n${target.image_prompt}\n* 반드시 이야기와 장르 '${story.genre}'의 핵심 요소(예: 공룡 장르면 사랑스럽고 귀여운 3D 아기 공룡들과 웅장한 공룡 시대 풍경)가 장면에 크고 생생하게 살아있어야 함!\n\n[Camera & Composition Guide]:\n${sceneRules[page]}. 다채로운 각도와 역동적인 포즈.\n\n[Character & Mascot Continuity]:\n${phodongIncluded?PHODONG:noPhodong}\n소중한 물건 '${story.object_name}'의 형태·색감·질감을 매 페이지 정확히 보존.\n\n[Rendering & Art Style]:\n${STYLE}`;

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

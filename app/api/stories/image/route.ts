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

  const humanNames = story.child_name.split(" · ");
  const humanCount = humanNames.length;
  const characterCountRule = `[Strict Character Count - CRITICAL]:\n* Exactly ${humanCount} human child character(s) (${story.child_name}) must appear in this image. Absolutely NO duplicate clones, NO extra children, NO background humans, and NO twins. There is only ONE ${story.child_name} in the scene.`;

  let response: Response;

  if(page === 0){
   // 1페이지: 전체 동화의 화풍과 캐릭터(주인공 + 포동이)를 결정짓는 핵심 앵커 생성
   const anchorPrompt=`[3D Storybook Masterpiece Illustration - Opening Scene - Genre: ${story.genre}]\n\n${characterCountRule}\n\n[Scene 1 Story]:\n${target.text}\n\n[Visual Details & Key Subjects]:\n${target.image_prompt}\n\n[Camera & Atmosphere]:\n${sceneRules[0]}. 방 안에서 소중한 물건 '${story.object_name}'(색상, 형태, 질감 정밀 묘사)이 신비롭게 빛나며 마법의 문이 열리는 따스한 장면. 장르 '${story.genre}'를 암시하는 신비로운 마법 빛무리와 방 안의 귀여운 소품들.\n\n[Character Continuity Base]:\n${phodongIncluded?PHODONG:noPhodong}\n주인공 아이(${story.child_name})와 포동이의 사랑스럽고 포근한 니트 착장과 귀여운 표정.\n\n[Rendering & Art Style]:\n${STYLE}`;

   response=await fetch("https://api.openai.com/v1/images/generations",{
    method:"POST",
    headers:{Authorization:`Bearer ${openAIKey()}`,"Content-Type":"application/json"},
    body:JSON.stringify({model:"gpt-image-1",prompt:anchorPrompt,size:"1024x1024",quality:"high",output_format:"png"})
   });
  } else {
   // 2~5페이지: 1페이지에서 확정된 주인공 아이와 포동이 캐릭터를 레퍼런스로 고정하고, 장르별 사건/배경으로 연속 전개
   const firstRow=await env.DB.prepare("SELECT b64 FROM story_images WHERE key=?").bind(`stories/${id}/page-1-style-v2.png`).first<{b64:string}>();
   if(!firstRow?.b64)return Response.json({error:"첫 번째 그림부터 다시 만들어 줘."},{status:409});

   const bin=atob(firstRow.b64);
   const refU8=new Uint8Array(bin.length);
   for(let i=0;i<bin.length;i++){refU8[i]=bin.charCodeAt(i);}

   const editPrompt=`[3D Storybook Continuation Scene ${page+1}/5 - Genre: ${story.genre}]\n\n${characterCountRule}\n\n[Strict Character Identity & Appearance Lock]:\nAttached image is Page 1 reference. Keep the EXACT SAME single child character (${story.child_name}): same face, hair, and character model. Do NOT clone the child. Do NOT add a second child. Exactly one child (${story.child_name}) and ${phodongIncluded?"one Phodong teddy bear":"no bears"}.\n\n[Full Genre Transformation - ${story.genre} World]:\n${target.text}\n${target.image_prompt}\n* Vividly depict the authentic '${story.genre}' world in rich detail! Fill the environment with charming genre-specific landscape, props, and companions (e.g. for Dinosaurs: adorable baby Triceratops/Brachiosaurus, gigantic prehistoric flora, glowing dino eggs, jungle vines, and cute adventure gear like explorer belts or magnifying tools).\n\n[Dynamic Scene & Action]:\n${sceneRules[page]}. Natural, lively interaction between ${story.child_name}, ${phodongIncluded?"Phodong, ":""}the precious object '${story.object_name}', and the ${story.genre} surroundings.\n\n[Style Consistency]:\n${STYLE}`;

   const form=new FormData();
   form.append("model","gpt-image-1");
   form.append("prompt",editPrompt);
   form.append("size","1024x1024");
   form.append("quality","high");
   form.append("output_format","png");
   form.append("image",new Blob([refU8.buffer],{type:"image/png"}),"page-1-character-reference.png");

   response=await fetch("https://api.openai.com/v1/images/edits",{
    method:"POST",
    headers:{Authorization:`Bearer ${openAIKey()}`},
    body:form
   });
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

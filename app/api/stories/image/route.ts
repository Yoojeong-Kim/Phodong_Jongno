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

  const STYLE = `Art Style & Rendering Specification:
Create an ultra-polished, premium 3D animated children’s illustration with a warm, magical, emotionally comforting tone. The image should feel like a high-end feature-film still from a luxurious family animation, with extremely soft tactile materials, rounded child-friendly forms, and a dreamy storybook atmosphere.
The overall visual language must emphasize softness, warmth, and cuteness while still maintaining a highly refined cinematic render quality. All subjects should have appealing rounded silhouettes, smooth contours, simplified but expressive facial structure, and a gentle, wholesome emotional presence. The style should feel elegant, plush, cozy, and emotionally inviting.
Human characters should be stylized as adorable young children with large expressive eyes, softly rounded cheeks, tiny delicate noses, small softly smiling mouths, smooth skin, subtle blush on the cheeks, and slightly oversized head proportions that enhance innocence and charm. Their facial features should be clean, clear, and readable, with glossy bright eyes that catch warm highlights and create an affectionate, lively expression. Hair should appear soft, fluffy, and delicately sculpted, with smooth strand grouping rather than realistic messy individual strands.
All materials throughout the image must have rich tactile realism within a stylized 3D animated world. Plush surfaces should show delicate fuzzy detail. Skin should be smooth and luminous with subtle subsurface scattering. Hair should be softly volumized and silky. Fabric should show fine textile detail and gentle thickness. Knitted or soft fabric surfaces should have visible weave detail and a cozy premium tactile feel. Hard surfaces in the environment should remain softly stylized, never too sharp or industrial.
Lighting: Warm, diffused, cinematic lighting with a strong sense of softness and glow. Combine gentle ambient illumination with warm directional light, as if sunlight is entering through a window during golden hour, mixed with soft interior practical light and occasional magical light sources. Faces and key subjects wrapped in flattering warm light with delicate falloff, soft shadow transitions, and subtle rim highlights. Mild volumetric light, faint bloom, and a soft luminous atmosphere. Nothing harsh, cold, flat, or over-contrasted.
Color Palette: Consistently warm and pastel-rich, centered around peach, blush pink, soft coral, cream, warm beige, ivory, and golden light. Background accents in dusty rose, warm apricot, soft caramel, muted pastel browns, and gentle sunlit neutrals. Bathed in a rosy-golden glow.
Rendering Quality: High-end cinematic 3D film render (global illumination, ambient occlusion, soft reflections, subtle subsurface scattering, clean specular highlights, delicate depth separation, smooth tonal transitions).
Camera & Composition: Child level or slightly above eye level, main subjects prominently in foreground or midground. Moderate cinematic lens feel, soft perspective, creamy bokeh, shallow depth of field.
Environment: Softly storybook-like, cozy, magical, and gently idealized with rounded, softened edges.
Absolute Constraints: No text, letters, words, logos, subtitles, or watermarks. No photorealism, no gritty textures, no deformed anatomy.`;

  const STYLE_PRESERVE_INSTRUCTION = `[Absolute Visual & Style Continuity Lock]:
* Strictly maintain the EXACT SAME ultra-polished premium 3D animation style, character face, facial proportions (large glossy eyes, cute blushing cheeks), hair color, hair styling, skin shading, and clothing texture as seen in the attached Page 1 reference image.
* Preserve the identical warm golden-peach pastel palette, soft luminous volumetric lighting, and velvety/plush tactile material quality.
* Only the character's pose, expression, camera angle, and background environment change to tell the new chapter of the story.`;

  const PHODONG = `포동이 외형: 포동이는 통통하고 포근한 꿀베이지색 봉제인형 곰돌이 캐릭터. 극도로 부드러운 프리미엄 플러시 토이 텍스처(벨벳 같은 미세 털 섬유 질감, 따뜻한 빛 아래 은은한 마이크로파이버 반사), 둥글둥글하고 깜찍한 귀, 작고 까만 단추 눈과 코, 발그레한 살구빛 볼과 손발바닥의 핑크 젤리 패드. 포근한 아이보리 꽈배기 니트 스웨터와 사랑스러운 빨간/코랄 나비 스카프. 크고 둥근 머리와 작고 통통한 몸매.`;
  const noPhodong = "포동이 및 곰·테디베어 캐릭터는 일체 등장시키지 말 것.";

  const humanNames = story.child_name.split(" · ");
  const humanCount = humanNames.length;
  const characterCountRule = `[Strict Character Count & Identity Lock - CRITICAL]:\n* Exactly ${humanCount} human child character(s) (${story.child_name}) must appear in this image. Absolutely NO duplicate clones, NO extra children, NO background humans, and NO twins. There is only ONE child (${story.child_name}).\n* CRITICAL: Do NOT change the child's gender, hairstyle, hair color, or clothing. The child's gender and identity must be 100% consistent across all pages!`;

  let response: Response;

  if(page === 0){
   // 1페이지: 전체 동화의 화풍과 캐릭터(주인공 + 포동이)를 결정짓는 핵심 앵커 생성
   const anchorPrompt=`[Masterpiece 3D CGI Storybook Illustration - Page 1 Anchor Scene - Genre: ${story.genre}]\n\n${characterCountRule}\n\n[Scene 1 Action & Environment]:\n${target.text}\n${target.image_prompt}\n* Indoor cozy bedroom setting where the precious object '${story.object_name}' glows with magical light.\n\n[Characters in Scene]:\n- Human Child: ${story.child_name}. Wearing cozy warm knitted sweater and pants. Joyful, wide starry eyes, cute rosy blushed cheeks.\n- Mascot: ${phodongIncluded?PHODONG:noPhodong}\n\n[Rendering & Art Style]:\n${STYLE}`;

   response=await fetch("https://api.openai.com/v1/images/generations",{
    method:"POST",
    headers:{Authorization:`Bearer ${openAIKey()}`,"Content-Type":"application/json"},
    body:JSON.stringify({model:"gpt-image-1",prompt:anchorPrompt,size:"1024x1024",quality:"high",output_format:"png"})
   });
  } else {
   // 2~5페이지: 1페이지의 고화질 렌더링을 참조 이미지로 넘겨 인물과 화풍을 고정
   const firstRow=await env.DB.prepare("SELECT b64 FROM story_images WHERE key=?").bind(`stories/${id}/page-1-style-v2.png`).first<{b64:string}>();
   if(!firstRow?.b64)return Response.json({error:"첫 번째 그림부터 다시 만들어 줘."},{status:409});

   const bin=atob(firstRow.b64);
   const refU8=new Uint8Array(bin.length);
   for(let i=0;i<bin.length;i++){refU8[i]=bin.charCodeAt(i);}

   const editPrompt=`[3D CGI Storybook Continuation - Page ${page+1}/5 - Genre: ${story.genre}]\n\n${characterCountRule}\n\n[Character & Style Continuity from Reference Image]:\n* Look at the attached Page 1 reference image carefully. The child ${story.child_name} MUST keep the EXACT SAME face, exact same gender, same haircut, same hair color, and same cozy clothing texture. Do NOT swap gender or clothes! Exactly one child and ${phodongIncluded?"one Phodong bear":"no bear"}.\n* ${STYLE_PRESERVE_INSTRUCTION}\n\n[New Scene in ${story.genre} World]:\n${target.text}\n${target.image_prompt}\n* Rich, immersive '${story.genre}' environment (e.g. friendly 3D dinosaurs, ancient jungle flora, dinosaur eggs, and cute adventurer accessories).\n\n[Action & Camera]:\n${sceneRules[page]}. Dynamic lively interactions.\n\n[Art Style]:\n${STYLE}`;

   const form=new FormData();
   form.append("model","gpt-image-1");
   form.append("prompt",editPrompt);
   form.append("size","1024x1024");
   form.append("quality","high");
   form.append("output_format","png");
   form.append("image",new Blob([refU8.buffer],{type:"image/png"}),"reference-character.png");

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

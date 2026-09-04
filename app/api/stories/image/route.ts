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
  if(target.image_url?.includes("style-v4"))return Response.json({image_url:target.image_url,complete:story.status==="complete"});
  const key=`stories/${id}/page-${page+1}-style-v4.png`;
  const existing=await env.DB.prepare("SELECT 1 FROM story_images WHERE key=?").bind(key).first();
  if(existing){
   target.image_url=`/api/story-images/${id}/page-${page+1}-style-v4.png`;
   const complete=story.pages.every(p=>p.image_url?.includes("style-v4"));
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
Human characters should be stylized as adorable young children with large expressive eyes, softly rounded cheeks, tiny delicate noses, small softly smiling mouths, smooth skin, subtle blush on the cheeks, and slightly oversized head proportions that enhance innocence and charm. Their facial features should be clean, clear, and readable, with crystal-clear glossy bright eyes that catch warm brilliant catchlight reflections and create an affectionate, lively expression. Hair should appear soft, fluffy, and delicately sculpted, with smooth strand grouping rather than realistic messy individual strands.
All materials throughout the image must have rich tactile realism within a stylized 3D animated world. Plush surfaces should show delicate fuzzy detail. Skin should be smooth and luminous with subtle warm peach subsurface scattering. Hair should be softly volumized and silky. Clothing and fabrics should show fine textile detail, gentle thickness, and accurate rendering of the chosen outfit. Hard surfaces in the environment should remain softly stylized, never too sharp or industrial.
Lighting: Radiant golden hour sunlight and warm, diffused cinematic lighting with a strong sense of softness and glow. Golden sunlight filtering through, creating warm amber-gold rim lighting on characters' hair and shoulders, mixed with soft interior practical light and magical light sources. Faces and key subjects wrapped in flattering warm golden-peach light with delicate falloff, soft shadow transitions, and subtle rim highlights. Mild volumetric light rays, faint dreamy bloom, and a luminous, vibrant storybook atmosphere.
Color Palette: Clean, rich, glowing, warm palette centered around peach, apricot, warm blush pink, creamy honey-beige, ivory, and glowing amber sunlight, balanced with lush, vibrant storybook environment tones. Bathed in a clear golden-rosy glow.
Rendering Quality: High-end cinematic 3D CGI film render (global illumination, ambient occlusion, soft reflections, subtle subsurface scattering, clean specular highlights, delicate depth separation, smooth tonal transitions).
Camera & Composition: Child level or slightly above eye level, main subjects prominently in foreground or midground. Moderate cinematic lens feel, soft perspective, creamy bokeh, shallow depth of field.
Environment: Softly storybook-like, cozy, magical, and gently idealized with rounded, softened edges.
Absolute Constraints & Negative Rules: Absolutely NO muddy, dull, murky, greyish, gloomy, or dirty desaturated colors. NO gritty textures, NO photorealism, NO deformed anatomy, and NO harsh dark shadows. The entire image must be radiant, clean, heartwarming, and colorful. Absolutely NO text, letters, words, logos, subtitles, or watermarks.`;

  const STYLE_PRESERVE_INSTRUCTION = `[Absolute Visual & Style Continuity Lock]:
* Strictly maintain the EXACT SAME ultra-polished premium 3D animation style, character face, facial proportions (large glossy eyes, cute blushing cheeks), hair color, hair styling, skin shading, and chosen clothing (outfit type and color) across all pages.
* Preserve the identical warm golden-peach palette, soft luminous volumetric lighting, and velvety/plush tactile material quality.
* Only the character's pose, expression, camera angle, and background environment change to tell the new chapter of the story.`;

  const PHODONG = `포동이 외형: 포동이는 통통하고 포근한 꿀베이지색 봉제인형 곰돌이 캐릭터. 극도로 부드러운 프리미엄 플러시 토이 텍스처(벨벳 같은 미세 털 섬유 질감, 따뜻한 빛 아래 은은한 마이크로파이버 반사), 둥글둥글하고 깜찍한 귀, 맑고 반짝이는 까만 단추 눈과 코, 발그레한 살구빛 볼과 손발바닥의 핑크 젤리 패드. 포근한 아이보리 꽈배기 니트 스웨터와 사랑스러운 빨간/코랄 나비 스카프. 크고 둥근 머리와 작고 통통한 몸매.`;
  const noPhodong = "포동이 및 곰·테디베어 캐릭터는 일체 등장시키지 말 것.";

  const genreEnvironments: Record<string, string> = {
    "공룡": "Rich, immersive dinosaur adventure setting with friendly, cute 3D dinosaurs, lush ancient prehistoric flora, clear waterfalls, and warm sunlit jungle pathways.",
    "요정": "Enchanted fairy forest setting with glowing whimsical mushroom houses, sparkling fairy dust, giant colorful blooming flowers, and magical soft morning light.",
    "공주와 왕자": "Magical royal kingdom setting with whimsical pastel fairytale castle towers, golden palace gardens, royal marble arches, and elegant storybook courtyards.",
    "동물": "Vibrant safari animal sanctuary setting with friendly cheerful animals, sun-dappled savanna meadows, acacia trees, and playful nature landscapes.",
    "우주": "Whimsical colorful space wonderland with friendly cartoon planets, twinkling spiral galaxies, floating crystal asteroids, and cute space explorer elements.",
    "전래동화": "Charming traditional Korean fairytale folk village setting with cozy hanok tiled roofs, stone pathways, persimmon trees, and soft paper-lantern glow."
  };
  const genreEnvGuide = genreEnvironments[story.genre] || `Rich, immersive '${story.genre}' storybook environment.`;

  const humanNames = story.child_name.split(" · ");
  const humanCount = humanNames.length;
  const characterCountRule = `[Strict Character Count & Identity Lock - CRITICAL]:\n* Exactly ${humanCount} distinct human child character(s) (${story.child_name}) must appear in this image.\n* Absolutely NO duplicate clones, NO extra children, NO background humans, and NO twins. Each child must be distinct. Total human children in the scene must be EXACTLY ${humanCount}.\n* CRITICAL: Strictly preserve each child's gender, hairstyle, hair color, and chosen outfit across all pages!`;

  const charAppearanceText = story.characters && story.characters.length > 0
    ? story.characters.map(c => `- Human Child (${c.name}): ${c.appearance}`).join("\n")
    : `- Human Child (${story.child_name}): Adorable stylized 7-year-old child with large expressive bright eyes, softly rounded blushing cheeks, cute smiling mouth. Strictly follow the character's hair style, hair color, outfit, and outfit color described in the scene prompt.`;

  let response: Response;

  const basePrompt = `[Masterpiece 3D CGI Storybook Illustration - Genre: ${story.genre}]\n\n${characterCountRule}\n\n[Characters in Scene]:\n${charAppearanceText}\n- Mascot: ${phodongIncluded?PHODONG:noPhodong}\n\n[Rendering & Art Style]:\n${STYLE}\n\n`;

  if(page === 0){
   // 1페이지: 전체 동화의 화풍과 캐릭터(주인공 + 포동이)를 결정짓는 핵심 앵커 생성
   const anchorPrompt=`${basePrompt}[Scene 1 Action & Environment]:\n${target.text}\n${target.image_prompt}\n* Indoor cozy bedroom setting where the precious object '${story.object_name}' glows with magical light.`;

   response=await fetch("https://api.openai.com/v1/images/generations",{
    method:"POST",
    headers:{Authorization:`Bearer ${openAIKey()}`,"Content-Type":"application/json"},
    body:JSON.stringify({model:"dall-e-3",prompt:anchorPrompt.substring(0, 4000),size:"1024x1024",quality:"hd",response_format:"b64_json"})
   });
  } else {
   // 2~5페이지: 텍스트 프롬프트를 통해 인물과 화풍 고정
   const editPrompt=`${basePrompt}[Strict Character & Style Continuity]:\n* Every child (${story.child_name}) MUST keep their EXACT SAME face, gender, haircut, hair color, and outfit (outfit type and color) as established in previous pages. Exactly ${humanCount} child character(s) and ${phodongIncluded?"one Phodong bear":"no bear"}.\n* ${STYLE_PRESERVE_INSTRUCTION}\n\n[New Scene in ${story.genre} World]:\n${target.text}\n${target.image_prompt}\n* ${genreEnvGuide}\n\n[Action & Camera]:\n${sceneRules[page]}. Dynamic lively interactions.`;

   response=await fetch("https://api.openai.com/v1/images/generations",{
    method:"POST",
    headers:{Authorization:`Bearer ${openAIKey()}`,"Content-Type":"application/json"},
    body:JSON.stringify({model:"dall-e-3",prompt:editPrompt.substring(0, 4000),size:"1024x1024",quality:"hd",response_format:"b64_json"})
   });
  }

  if(!response.ok){const detail=await response.text();console.error("image_api",response.status,detail.slice(0,500));throw new Error(`이미지 API 오류 ${response.status}`)}
  const data=await response.json() as any,b64=data.data?.[0]?.b64_json;if(!b64)throw new Error("이미지 데이터 없음");
  await env.DB.prepare("INSERT INTO story_images (key,b64,created_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET b64=excluded.b64").bind(key,b64,Date.now()).run();
  target.image_url=`/api/story-images/${id}/page-${page+1}-style-v4.png`;
  const complete=story.pages.every(p=>p.image_url?.includes("style-v4"));
  await env.DB.prepare("UPDATE stories SET pages_json=?, status=? WHERE id=?").bind(JSON.stringify(story.pages),complete?"complete":"generating",id).run();
  return Response.json({image_url:target.image_url,complete});
 }catch(e){console.error("image_gen_failed",e instanceof Error?e.message:String(e));return Response.json({error:"삽화를 만드는 데 실패했어."},{status:500})}
 finally{try{if(slotAcquired&&lockId&&Number.isInteger(lockPage))await env.DB.prepare("UPDATE image_slots SET story_id=NULL,page=NULL,locked_until=0 WHERE story_id=? AND page=?").bind(lockId,lockPage).run()}catch{}}
}

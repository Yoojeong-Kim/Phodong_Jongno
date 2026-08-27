import { env } from "cloudflare:workers";
import { ensureStoryTables, openAIKey, rowToStory } from "../../../../lib/story-store";

export async function POST(req:Request){
 try{
  await ensureStoryTables();
  const {id,page}=await req.json() as {id:string,page:number};
  if(!/^[0-9a-f-]{36}$/.test(id)||!Number.isInteger(page)||page<0||page>6)return Response.json({error:"잘못된 요청이야."},{status:400});
  const row=await env.DB.prepare("SELECT * FROM stories WHERE id=?").bind(id).first();
  if(!row)return Response.json({error:"동화를 찾지 못했어."},{status:404});
  const story=rowToStory(row),target=story.pages[page];
  if(target.image_url)return Response.json({image_url:target.image_url,complete:story.status==="complete"});
  const prompt=`장면 ${page+1}/7: ${target.image_prompt}\n연속성 최우선 규칙: 이 동화의 모든 페이지는 같은 한 권의 그림책이다. 포동이의 복숭아색 털, 둥근 얼굴, 검은 단추 눈, 흰 주둥이, 분홍 볼과 체형을 고정한다. 아이 캐릭터의 얼굴형, 머리 모양, 피부색, 옷 색과 무늬를 고정한다. '${story.object_name}'의 색, 형태, 재질, 크기를 모든 페이지에서 동일하게 유지한다. 따뜻한 분홍·크림 팔레트와 세련된 3D 동화책 렌더링, 부드러운 조명, 재질 표현, 카메라 화각을 한 명의 일러스트레이터가 그린 것처럼 통일한다. 첨부된 첫 장 그림이 있다면 오직 캐릭터와 화풍의 기준으로 사용하고, 이번 페이지 내용에 맞는 완전히 새로운 구도와 행동을 그린다. 어린이 동화용이며 무섭거나 위험한 요소는 제외한다. 글자, 자막, 로고, 워터마크는 넣지 않는다.`;
  let response:Response;
  const reference=page>0?await env.STORY_IMAGES.get(`stories/${id}/page-1.png`):null;
  if(reference){const form=new FormData();form.append("model","gpt-image-1-mini");form.append("prompt",prompt);form.append("size","1024x1024");form.append("quality","medium");form.append("output_format","png");form.append("image",new Blob([await reference.arrayBuffer()],{type:"image/png"}),"character-reference.png");response=await fetch("https://api.openai.com/v1/images/edits",{method:"POST",headers:{Authorization:`Bearer ${openAIKey()}`},body:form})}
  else response=await fetch("https://api.openai.com/v1/images/generations",{method:"POST",headers:{Authorization:`Bearer ${openAIKey()}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-image-1-mini",prompt,size:"1024x1024",quality:"medium",output_format:"png"})});
  if(!response.ok){const detail=await response.text();console.error("image_api",response.status,detail.slice(0,500));throw new Error(`이미지 API 오류 ${response.status}`)}
  const data=await response.json() as any,b64=data.data?.[0]?.b64_json;if(!b64)throw new Error("이미지 데이터 없음");
  const key=`stories/${id}/page-${page+1}.png`,bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  await env.STORY_IMAGES.put(key,bytes,{httpMetadata:{contentType:"image/png"}});
  target.image_url=`/api/story-images/${id}/page-${page+1}.png`;
  const complete=story.pages.every(p=>p.image_url);
  await env.DB.prepare("UPDATE stories SET pages_json=?, status=? WHERE id=?").bind(JSON.stringify(story.pages),complete?"complete":"generating",id).run();
  return Response.json({image_url:target.image_url,complete});
 }catch(e){console.error(e);return Response.json({error:"삽화를 만드는 데 실패했어."},{status:500})}
}

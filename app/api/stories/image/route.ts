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
  const prompt=`${target.image_prompt}\n일관성 규칙: 포동이는 복숭아색 털, 둥근 얼굴, 검은 단추 눈, 흰 주둥이, 분홍 볼을 가진 친근한 곰 캐릭터다. 앞 페이지와 이어지는 한 장면처럼 표현해. 어린이 동화용이며 무섭거나 위험한 요소는 제외해. 글자, 자막, 로고, 워터마크는 넣지 마.`;
  const response=await fetch("https://api.openai.com/v1/images/generations",{method:"POST",headers:{Authorization:`Bearer ${openAIKey()}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-image-1-mini",prompt,size:"1024x1024",quality:"medium",output_format:"png"})});
  if(!response.ok)throw new Error(`이미지 API 오류 ${response.status}`);
  const data=await response.json() as any,b64=data.data?.[0]?.b64_json;if(!b64)throw new Error("이미지 데이터 없음");
  const key=`stories/${id}/page-${page+1}.png`,bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  await env.STORY_IMAGES.put(key,bytes,{httpMetadata:{contentType:"image/png"}});
  target.image_url=`/api/story-images/${id}/page-${page+1}.png`;
  const complete=story.pages.every(p=>p.image_url);
  await env.DB.prepare("UPDATE stories SET pages_json=?, status=? WHERE id=?").bind(JSON.stringify(story.pages),complete?"complete":"generating",id).run();
  return Response.json({image_url:target.image_url,complete});
 }catch(e){console.error(e);return Response.json({error:"삽화를 만드는 데 실패했어."},{status:500})}
}

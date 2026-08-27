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
  if(target.image_url?.includes("style-v2"))return Response.json({image_url:target.image_url,complete:story.status==="complete"});
  const prompt=`장면 ${page+1}/7: ${target.image_prompt}\n\n첨부 이미지는 절대적인 시각 기준이다. 같은 제작사, 같은 3D 렌더러, 같은 캐릭터 모델 시트로 만든 한 권의 동화처럼 보여야 한다. 기준 이미지의 밝고 화사한 복숭아·블러시 핑크·크림 팔레트, 깨끗한 흰색 기준점, 부드러운 아침 햇빛, 포근한 니트와 털의 미세한 촉감, 둥글고 친근한 얼굴 비율, 맑고 반짝이는 검은 눈, 생기 있는 분홍 볼, 고급 장편 애니메이션 수준의 정교한 3D 렌더링을 그대로 유지한다. 전체 화면은 밝고 따뜻하며 사랑스럽고 안전해야 한다.\n\n캐릭터 잠금: 포동이의 얼굴, 귀, 눈, 주둥이, 체형, 털색, 목 스카프를 기준 이미지와 동일하게 유지한다. 주인공 아이의 얼굴형, 눈, 코, 머리 길이와 모양, 피부색, 체형, 옷의 색과 무늬를 1페이지와 완전히 동일하게 유지한다. '${story.object_name}'의 색, 형태, 재질과 크기도 동일하게 유지한다. 페이지마다 바꾸는 것은 이야기 내용에 따른 장소, 자세, 표정, 행동, 카메라 구도뿐이다. 새 캐릭터로 재해석하거나 나이·성별·머리·옷을 바꾸지 않는다.\n\n금지: 탁한 갈색 또는 회색 필터, 어두운 노출, 공포 분위기, 날카로운 그림자, 무서운 표정, 움푹한 눈, 기괴한 손, 낡거나 더러운 재질, 저채도, 빈티지 세피아, 값싼 플라스틱, 다른 화풍, 실사 인물, 텍스트, 자막, 로고, 워터마크.`;
  let referenceBytes:ArrayBuffer;
  if(page>0){const first=await env.STORY_IMAGES.get(`stories/${id}/page-1-style-v2.png`);if(!first)return Response.json({error:"첫 번째 그림부터 다시 만들어 줘."},{status:409});referenceBytes=await first.arrayBuffer()}
  else{const style=await fetch(new URL("/story-style-reference-v1.png",req.url));if(!style.ok)throw new Error("스타일 기준 이미지를 찾지 못했어.");referenceBytes=await style.arrayBuffer()}
  const form=new FormData();form.append("model","gpt-image-2");form.append("prompt",prompt);form.append("size","1024x1024");form.append("quality","high");form.append("output_format","png");form.append("image",new Blob([referenceBytes],{type:"image/png"}),page===0?"fixed-style-reference.png":"page-one-character-reference.png");
  const response=await fetch("https://api.openai.com/v1/images/edits",{method:"POST",headers:{Authorization:`Bearer ${openAIKey()}`},body:form});
  if(!response.ok){const detail=await response.text();console.error("image_api",response.status,detail.slice(0,500));throw new Error(`이미지 API 오류 ${response.status}`)}
  const data=await response.json() as any,b64=data.data?.[0]?.b64_json;if(!b64)throw new Error("이미지 데이터 없음");
  const key=`stories/${id}/page-${page+1}-style-v2.png`,bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  await env.STORY_IMAGES.put(key,bytes,{httpMetadata:{contentType:"image/png"}});
  target.image_url=`/api/story-images/${id}/page-${page+1}.png`;
  const complete=story.pages.every(p=>p.image_url?.includes("style-v2"));
  await env.DB.prepare("UPDATE stories SET pages_json=?, status=? WHERE id=?").bind(JSON.stringify(story.pages),complete?"complete":"generating",id).run();
  return Response.json({image_url:target.image_url,complete});
 }catch(e){console.error(e);return Response.json({error:"삽화를 만드는 데 실패했어."},{status:500})}
}

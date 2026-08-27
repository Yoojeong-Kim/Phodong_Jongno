import { env } from "cloudflare:workers";
import { ensureStoryTables, openAIKey, rowToStory } from "../../../lib/story-store";
import { STORY_SYSTEM_PROMPT, storyInput } from "../../../lib/story-prompt";

const genres=new Set(["공룡","요정","공주와 왕자","동물","우주","전래동화"]);
const storySchema={type:"object",additionalProperties:false,required:["title","summary","pages"],properties:{title:{type:"string"},summary:{type:"string"},pages:{type:"array",minItems:7,maxItems:7,items:{type:"object",additionalProperties:false,required:["page","title","text","image_prompt"],properties:{page:{type:"integer"},title:{type:"string"},text:{type:"string"},image_prompt:{type:"string"}}}}}};

function outputText(data:any){for(const item of data.output||[])for(const content of item.content||[])if(content.type==="output_text")return content.text;throw new Error("동화 응답을 읽지 못했어.")}

async function openAIFetch(url:string,init:RequestInit,retries=2){let response:Response|null=null;for(let attempt=0;attempt<=retries;attempt++){response=await fetch(url,init);if(response.ok||![429,500,502,503,504].includes(response.status))return response;if(attempt<retries)await new Promise(resolve=>setTimeout(resolve,600*(attempt+1)))}return response!}

export async function GET(req:Request){
 await ensureStoryTables();
 const id=new URL(req.url).searchParams.get("id");
 if(id){const row=await env.DB.prepare("SELECT * FROM stories WHERE id=? AND status='complete'").bind(id).first();return row?Response.json(rowToStory(row)):Response.json({error:"동화를 찾지 못했어."},{status:404})}
 const result=await env.DB.prepare("SELECT * FROM stories WHERE status='complete' ORDER BY created_at DESC LIMIT 60").all();
 return Response.json({stories:(result.results||[]).map(rowToStory)});
}

export async function POST(req:Request){
 let stage="start";
 try{
  stage="database";
  await ensureStoryTables();
  const count=await env.DB.prepare("SELECT COUNT(*) AS count FROM stories").first<{count:number}>();
  if((count?.count||0)>=30)return Response.json({error:"오늘 준비한 동화를 모두 만들었어. 관리자에게 알려 줘!"},{status:429});
  const body=await req.json() as any;
  const childName=String(body.childName||"").trim().slice(0,20),objectName=String(body.objectName||"").trim().slice(0,40),meaning=String(body.meaning||"").trim().slice(0,300),genre=String(body.genre||""),photo=String(body.photo||"");
  if(!childName||!objectName||!meaning||!genres.has(genre)||!photo.startsWith("data:image/"))return Response.json({error:"입력한 내용을 다시 확인해 줘."},{status:400});
  if(!/^data:image\/(jpeg|png|webp|gif);base64,/i.test(photo))return Response.json({error:"사진을 읽기 어려워. 다시 찍거나 다른 사진을 골라 줘."},{status:400});
  const key=openAIKey(),userText=storyInput({childName,objectName,meaning,genre});
  stage="moderation";
  try{const moderation=await openAIFetch("https://api.openai.com/v1/moderations",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:"omni-moderation-latest",input:[{type:"text",text:userText},{type:"image_url",image_url:{url:photo}}]})},1);if(moderation.ok){const mod=await moderation.json() as any;if(mod.results?.[0]?.flagged)return Response.json({error:"다른 사진이나 이야기로 다시 시도해 줘."},{status:400})}}catch(e){console.warn("moderation_skipped",e instanceof Error?e.message:String(e))}
  stage="story_api";
  const response=await openAIFetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-5.4-mini",reasoning:{effort:"low"},input:[{role:"system",content:[{type:"input_text",text:STORY_SYSTEM_PROMPT}]},{role:"user",content:[{type:"input_text",text:userText},{type:"input_image",image_url:photo}]}],text:{format:{type:"json_schema",name:"phodong_story",strict:true,schema:storySchema}}})});
  if(!response.ok){const detail=await response.text();console.error("story_api",response.status,detail.slice(0,500));if(response.status===400)return Response.json({error:"사진을 읽기 어려워. 다시 찍거나 다른 사진을 골라 줘."},{status:400});if(response.status===429)return Response.json({error:"포동이가 잠깐 너무 바빠. 1분 뒤 다시 눌러 줘."},{status:429});throw new Error(`동화 API 오류 ${response.status}`)}
  const generated=JSON.parse(outputText(await response.json()));
  stage="save";
  const id=crypto.randomUUID(),now=Date.now();
  await env.DB.prepare("INSERT INTO stories (id,child_name,genre,object_name,title,summary,pages_json,status,created_at) VALUES (?,?,?,?,?,?,?,'generating',?)").bind(id,childName,genre,objectName,generated.title,generated.summary,JSON.stringify(generated.pages),now).run();
  return Response.json({story:{id,child_name:childName,genre,object_name:objectName,title:generated.title,summary:generated.summary,pages:generated.pages,status:"generating",created_at:now}});
 }catch(e){console.error("story_create_failed",stage,e instanceof Error?e.message:String(e));return Response.json({error:stage==="save"?"동화는 만들었는데 저장하지 못했어. 한 번만 다시 눌러 줘.":"포동이가 잠깐 멈췄어. 사진은 그대로 두고 한 번만 다시 눌러 줘."},{status:500})}
}

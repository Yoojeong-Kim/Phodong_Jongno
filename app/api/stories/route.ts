import { env } from "cloudflare:workers";
import { ensureStoryTables, openAIKey, rowToStory } from "../../../lib/story-store";
import { STORY_SYSTEM_PROMPT, storyInput } from "../../../lib/story-prompt";

const genres=new Set(["공룡","요정","공주와 왕자","동물","우주","전래동화"]);
const storySchema={type:"object",additionalProperties:false,required:["title","summary","pages"],properties:{title:{type:"string"},summary:{type:"string"},pages:{type:"array",minItems:7,maxItems:7,items:{type:"object",additionalProperties:false,required:["page","title","text","image_prompt"],properties:{page:{type:"integer"},title:{type:"string"},text:{type:"string"},image_prompt:{type:"string"}}}}}};

function outputText(data:any){for(const item of data.output||[])for(const content of item.content||[])if(content.type==="output_text")return content.text;throw new Error("동화 응답을 읽지 못했어.")}

export async function GET(req:Request){
 await ensureStoryTables();
 const id=new URL(req.url).searchParams.get("id");
 if(id){const row=await env.DB.prepare("SELECT * FROM stories WHERE id=? AND status='complete'").bind(id).first();return row?Response.json(rowToStory(row)):Response.json({error:"동화를 찾지 못했어."},{status:404})}
 const result=await env.DB.prepare("SELECT * FROM stories WHERE status='complete' ORDER BY created_at DESC LIMIT 60").all();
 return Response.json({stories:(result.results||[]).map(rowToStory)});
}

export async function POST(req:Request){
 try{
  await ensureStoryTables();
  const count=await env.DB.prepare("SELECT COUNT(*) AS count FROM stories").first<{count:number}>();
  if((count?.count||0)>=30)return Response.json({error:"오늘 준비한 동화를 모두 만들었어. 관리자에게 알려 줘!"},{status:429});
  const body=await req.json() as any;
  const childName=String(body.childName||"").trim().slice(0,20),objectName=String(body.objectName||"").trim().slice(0,40),meaning=String(body.meaning||"").trim().slice(0,300),genre=String(body.genre||""),photo=String(body.photo||"");
  if(!childName||!objectName||!meaning||!genres.has(genre)||!photo.startsWith("data:image/"))return Response.json({error:"입력한 내용을 다시 확인해 줘."},{status:400});
  const key=openAIKey(),userText=storyInput({childName,objectName,meaning,genre});
  const moderation=await fetch("https://api.openai.com/v1/moderations",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:"omni-moderation-latest",input:[{type:"text",text:userText},{type:"image_url",image_url:{url:photo}}]})});
  if(moderation.ok){const mod=await moderation.json() as any;if(mod.results?.[0]?.flagged)return Response.json({error:"다른 사진이나 이야기로 다시 시도해 줘."},{status:400})}
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-5.4-mini",reasoning:{effort:"low"},input:[{role:"system",content:[{type:"input_text",text:STORY_SYSTEM_PROMPT}]},{role:"user",content:[{type:"input_text",text:userText},{type:"input_image",image_url:photo}]}],text:{format:{type:"json_schema",name:"phodong_story",strict:true,schema:storySchema}}})});
  if(!response.ok)throw new Error(`동화 API 오류 ${response.status}`);
  const generated=JSON.parse(outputText(await response.json()));
  const id=crypto.randomUUID(),now=Date.now();
  await env.DB.prepare("INSERT INTO stories (id,child_name,genre,object_name,title,summary,pages_json,status,created_at) VALUES (?,?,?,?,?,?,?,'generating',?)").bind(id,childName,genre,objectName,generated.title,generated.summary,JSON.stringify(generated.pages),now).run();
  return Response.json({story:{id,child_name:childName,genre,object_name:objectName,title:generated.title,summary:generated.summary,pages:generated.pages,status:"generating",created_at:now}});
 }catch(e){console.error(e);return Response.json({error:"포동이가 이야기를 만드는 데 실패했어. 잠시 후 다시 해 줘."},{status:500})}
}

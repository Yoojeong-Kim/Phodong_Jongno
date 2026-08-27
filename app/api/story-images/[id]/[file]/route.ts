import { env } from "cloudflare:workers";
export async function GET(_:Request,{params}:{params:Promise<{id:string,file:string}>}){
 const {id,file}=await params;
 if(!/^[0-9a-f-]{36}$/.test(id)||!/^page-[1-7]\.png$/.test(file))return new Response("Not found",{status:404});
 const object=await env.STORY_IMAGES.get(`stories/${id}/${file}`);
 if(!object)return new Response("Not found",{status:404});
 return new Response(object.body,{headers:{"Content-Type":"image/png","Cache-Control":"public, max-age=31536000, immutable"}});
}

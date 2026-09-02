import { env } from "cloudflare:workers";

export type StoryPage={page:number;title:string;text:string;image_prompt:string;image_url?:string};
export type StoryRecord={id:string;child_name:string;genre:string;object_name:string;title:string;summary:string;pages:StoryPage[];stickers?:unknown[];drawings?:unknown[];status:string;created_at:number};

export async function ensureStoryTables(){
 const db=env.DB;
 await db.batch([
  db.prepare(`CREATE TABLE IF NOT EXISTS stories (id TEXT PRIMARY KEY, child_name TEXT NOT NULL, genre TEXT NOT NULL, object_name TEXT NOT NULL, title TEXT NOT NULL, summary TEXT NOT NULL, pages_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'generating', created_at INTEGER NOT NULL)`),
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_stories_status_created ON stories(status, created_at DESC)`),
  db.prepare(`CREATE TABLE IF NOT EXISTS image_slots (slot INTEGER PRIMARY KEY, story_id TEXT, page INTEGER, locked_until INTEGER NOT NULL DEFAULT 0)`),
  db.prepare(`INSERT OR IGNORE INTO image_slots (slot,locked_until) VALUES (1,0),(2,0),(3,0)`),
  db.prepare(`CREATE TABLE IF NOT EXISTS story_stickers (story_id TEXT PRIMARY KEY, stickers_json TEXT NOT NULL DEFAULT '[]')`)
 ]);
}
export function rowToStory(row:any):StoryRecord{const saved=JSON.parse(row.stickers_json||"[]"),decoration=Array.isArray(saved)?{stickers:saved,drawings:[]}:{stickers:saved.stickers||[],drawings:saved.drawings||[]};return {...row,pages:JSON.parse(row.pages_json),...decoration}}
export function openAIKey(){const key=(env as any).OPENAI_API_KEY||process.env.OPENAI_API_KEY;if(!key)throw new Error("OPENAI_API_KEY is not configured");return key}

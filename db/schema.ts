import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const stories = sqliteTable("stories", {
  id: text("id").primaryKey(),
  childName: text("child_name").notNull(),
  genre: text("genre").notNull(),
  objectName: text("object_name").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  pagesJson: text("pages_json").notNull(),
  status: text("status").notNull().default("generating"),
  createdAt: integer("created_at").notNull(),
});

CREATE TABLE `stories` (
	`id` text PRIMARY KEY NOT NULL,
	`child_name` text NOT NULL,
	`genre` text NOT NULL,
	`object_name` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`pages_json` text NOT NULL,
	`status` text DEFAULT 'generating' NOT NULL,
	`created_at` integer NOT NULL
);

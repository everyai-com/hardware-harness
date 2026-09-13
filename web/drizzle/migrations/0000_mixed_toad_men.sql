CREATE TABLE `designs` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`prompt` text,
	`spec_json` text NOT NULL,
	`score_json` text NOT NULL,
	`score_total` real NOT NULL,
	`gates_passed` integer DEFAULT false NOT NULL,
	`model_used` text,
	`produced_by` text,
	`remix_of` text,
	`category` text,
	`author` text,
	`likes` integer DEFAULT 0 NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`is_public` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `designs_score_idx` ON `designs` (`score_total`);--> statement-breakpoint
CREATE INDEX `designs_created_idx` ON `designs` (`created_at`);--> statement-breakpoint
CREATE INDEX `designs_remix_idx` ON `designs` (`remix_of`);--> statement-breakpoint
CREATE TABLE `kits` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`tagline` text NOT NULL,
	`description` text NOT NULL,
	`source_url` text NOT NULL,
	`kit_url` text,
	`license` text,
	`cost_note` text,
	`harness_score` real,
	`featured` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `votes` (
	`design_id` text NOT NULL,
	`voter_hash` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `votes_design_voter_idx` ON `votes` (`design_id`,`voter_hash`);
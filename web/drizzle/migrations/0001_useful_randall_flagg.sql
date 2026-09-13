CREATE TABLE `outcomes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`design_id` text NOT NULL,
	`kind` text NOT NULL,
	`summary` text NOT NULL,
	`data_json` text,
	`author` text DEFAULT 'anonymous' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `outcomes_design_idx` ON `outcomes` (`design_id`);
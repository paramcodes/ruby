CREATE TABLE "workspace" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "page" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"parent_id" text,
	"title" text NOT NULL,
	"sort_order" integer NOT NULL,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "page_workspace_id_id_unique" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page" ADD CONSTRAINT "page_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page" ADD CONSTRAINT "page_workspace_parent_fk" FOREIGN KEY ("workspace_id","parent_id") REFERENCES "public"."page"("workspace_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "page_workspace_parent_sort_idx" ON "page" USING btree ("workspace_id","parent_id","sort_order");
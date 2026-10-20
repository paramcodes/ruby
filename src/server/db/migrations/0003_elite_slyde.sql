ALTER TABLE "page_content" DROP CONSTRAINT "page_content_page_id_page_id_fk";
--> statement-breakpoint
ALTER TABLE "page_content" ADD CONSTRAINT "page_content_workspace_page_fk" FOREIGN KEY ("workspace_id","page_id") REFERENCES "public"."page"("workspace_id","id") ON DELETE cascade ON UPDATE no action;
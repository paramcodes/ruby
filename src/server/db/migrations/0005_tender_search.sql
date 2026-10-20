CREATE INDEX "page_search_title_idx" ON "page" USING gin (to_tsvector('english', "title"));--> statement-breakpoint
CREATE INDEX "page_search_content_idx" ON "page_content" USING gin (to_tsvector('english', "search_text"));--> statement-breakpoint

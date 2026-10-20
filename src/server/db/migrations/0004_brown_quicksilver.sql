CREATE TABLE "favorite" (
	"user_id" text NOT NULL,
	"page_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "favorite_user_id_page_id_pk" PRIMARY KEY("user_id","page_id")
);
--> statement-breakpoint
CREATE TABLE "page_view" (
	"user_id" text NOT NULL,
	"page_id" text NOT NULL,
	"viewed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "page_view_user_id_page_id_pk" PRIMARY KEY("user_id","page_id")
);
--> statement-breakpoint
ALTER TABLE "favorite" ADD CONSTRAINT "favorite_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite" ADD CONSTRAINT "favorite_page_id_page_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."page"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_view" ADD CONSTRAINT "page_view_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_view" ADD CONSTRAINT "page_view_page_id_page_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."page"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "favorite_page_id_idx" ON "favorite" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "page_view_user_id_idx" ON "page_view" USING btree ("user_id");
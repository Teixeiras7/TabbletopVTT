CREATE TABLE "tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cena_id" uuid NOT NULL,
	"personagem_id" uuid NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	CONSTRAINT "tokens_cena_personagem" UNIQUE("cena_id","personagem_id")
);
--> statement-breakpoint
ALTER TABLE "tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_cena_id_cenas_id_fk" FOREIGN KEY ("cena_id") REFERENCES "public"."cenas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_personagem_id_personagens_id_fk" FOREIGN KEY ("personagem_id") REFERENCES "public"."personagens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "tokens_ler_membro" ON "tokens" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from cenas s join membros m on m.mesa_id = s.mesa_id where s.id = "tokens"."cena_id" and m.usuario_id = auth.uid()));--> statement-breakpoint
ALTER TABLE "tokens" REPLICA IDENTITY FULL;--> statement-breakpoint
ALTER PUBLICATION supabase_realtime ADD TABLE "tokens";

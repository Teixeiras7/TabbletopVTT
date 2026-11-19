ALTER TABLE "personagens" ADD COLUMN "dinheiro" numeric(10, 1) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "personagens" ADD COLUMN "inventario" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "personagens" ADD COLUMN "negociacao" jsonb;--> statement-breakpoint
-- Dinheiro inicial dos personagens que já existem: soma das CO das carreiras iniciais (livro, p. 105).
UPDATE "personagens" p SET "dinheiro" = coalesce((SELECT sum((c."inicial"->'gear'->>'co')::numeric) FROM "carreiras" c WHERE c."id" IN (SELECT jsonb_array_elements(p."escolhas"->'careers')->>'career')), 0);

// Carrega data/catalog/*.json nas tabelas do catálogo (apaga e recarrega tudo numa transação).
// Uso: npm run db:seed (Node 24 roda TypeScript direto). Usa DIRECT_URL, como as migrations.
// O formato dos JSON é validado por src/lib/catalog/catalog.test.ts — rode `npm test` antes.
// Textos do livro: se existir manual/textos-livro.json (fora do git; gerado por scripts/textos-livro.py a partir do
// PDF), ele substitui os resumos de magias e habilidades e traz os detalhes dos equipamentos. Só vai para o banco.
import { existsSync, readFileSync } from "node:fs";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as s from "../src/lib/db/schema.ts";

config({ path: ".env.local", quiet: true });
if (!process.env.DIRECT_URL) throw new Error("DIRECT_URL não definida (.env.local).");

const read = (file: string) => JSON.parse(readFileSync(`data/catalog/${file}`, "utf8"));
type Book = { spells: Record<string, string>; abilities: Record<string, string>; equipment: Record<string, unknown> };
const BOOK = "manual/textos-livro.json";
const book: Book = existsSync(BOOK) ? JSON.parse(readFileSync(BOOK, "utf8")) : { spells: {}, abilities: {}, equipment: {} };
const withText = (rows: { slug: string; text: string }[], texts: Record<string, string>) => rows.map((r) => ({ ...r, text: texts[r.slug] ?? r.text }));
const tables = [
  [s.races, read("races.json")],
  [s.archetypes, read("archetypes.json")],
  [s.careers, read("careers.json")],
  [s.skills, read("skills.json")],
  [s.abilities, withText(read("abilities.json"), book.abilities)],
  [s.spells, withText(read("spells.json"), book.spells)],
  [s.spellLists, read("spell-lists.json")],
  [s.connections, read("connections.json")],
  [s.actions, read("actions.json")],
  [s.progression, [{ id: "padrao", ...read("progression.json") }]],
  [s.equipment, read("equipment.json").map((e: { slug: string }) => ({ ...e, details: book.equipment[e.slug] ?? null }))],
] as const;

const client = postgres(process.env.DIRECT_URL, { prepare: false, max: 1 });
try {
  await drizzle(client).transaction(async (tx) => {
    for (const [table, rows] of tables) {
      await tx.delete(table);
      await tx.insert(table).values(rows);
    }
  });
  if (!existsSync(BOOK)) console.warn(`${BOOK} não encontrado: magias e habilidades com os resumos, equipamentos sem detalhes.`);
  console.log("catálogo carregado:", tables.map(([, rows]) => rows.length).join(" + "), "linhas (o `npm run dev` lê o novo em até 1 minuto).");
} finally {
  await client.end();
}

// Carrega data/catalog/*.json nas tabelas do catálogo (apaga e recarrega tudo numa transação).
// Uso: npm run db:seed (Node 24 roda TypeScript direto). Usa DIRECT_URL, como as migrations.
// O formato dos JSON é validado por src/lib/catalog/catalog.test.ts — rode `npm test` antes.
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as s from "../src/lib/db/schema.ts";

config({ path: ".env.local", quiet: true });
if (!process.env.DIRECT_URL) throw new Error("DIRECT_URL não definida (.env.local).");

const read = (file: string) => JSON.parse(readFileSync(`data/catalog/${file}`, "utf8"));
const tables = [
  [s.races, read("races.json")],
  [s.archetypes, read("archetypes.json")],
  [s.careers, read("careers.json")],
  [s.skills, read("skills.json")],
  [s.abilities, read("abilities.json")],
  [s.spells, read("spells.json")],
  [s.spellLists, read("spell-lists.json")],
  [s.connections, read("connections.json")],
  [s.actions, read("actions.json")],
  [s.progression, [{ id: "padrao", ...read("progression.json") }]],
  [s.equipment, read("equipment.json")],
] as const;

const client = postgres(process.env.DIRECT_URL, { prepare: false, max: 1 });
try {
  await drizzle(client).transaction(async (tx) => {
    for (const [table, rows] of tables) {
      await tx.delete(table);
      await tx.insert(table).values(rows);
    }
  });
  console.log("catálogo carregado:", tables.map(([, rows]) => rows.length).join(" + "), "linhas (o `npm run dev` lê o novo em até 1 minuto).");
} finally {
  await client.end();
}

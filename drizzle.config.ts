import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

/**
 * DDL (migrate/push) precisa da conexão em modo "session" (porta 5432), não
 * do pooler em modo "transaction" (porta 6543, `DATABASE_URL`) usado em
 * runtime: descobrimos que o pooler em modo transaction engole comandos DDL
 * silenciosamente — `drizzle-kit migrate` reportava sucesso e gravava a
 * migração como aplicada, mas a tabela nunca era criada de fato.
 */
const migrationUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!migrationUrl) {
  throw new Error("DIRECT_URL (ou DATABASE_URL) não definido (verifique .env.local).");
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: migrationUrl,
  },
});

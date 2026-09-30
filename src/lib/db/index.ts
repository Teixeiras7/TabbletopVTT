import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env.server";
import * as schema from "./schema";

/**
 * Cliente Postgres único por processo. Em ambiente serverless (Vercel),
 * `DATABASE_URL` deve apontar para o pooler em modo transação da Supabase
 * (porta 6543), não para a conexão direta — evita esgotar conexões sob
 * concorrência.
 */
const client = postgres(env.DATABASE_URL, { prepare: false });

export const db = drizzle(client, { schema });

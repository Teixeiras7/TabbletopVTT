import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env.server";
import * as schema from "./schema";

/**
 * Cliente Postgres único por processo, pelo pooler do Supabase em modo transação (porta 6543).
 *
 * `max_pipeline: 0`: o driver, quando todas as conexões estão ocupadas, empilha várias consultas na
 * mesma conexão (pipelining). O pooler em modo transação não aguenta isso: a conexão do servidor fica
 * presa esperando o cliente (`ClientRead`) e o pool inteiro trava — páginas levavam minutos e davam erro.
 * Sem pipelining, consultas extras esperam uma conexão livre. Efeito colateral: `sql.begin`/`db.transaction`
 * não funcionam com max_pipeline 0 (o driver nunca reserva a conexão); use um comando só (CTE), como em createTable.
 *
 * Em desenvolvimento o cliente fica em `globalThis`: senão cada recarga do módulo abriria um pool novo
 * e deixaria o antigo com conexões abertas.
 */
const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };
const options = { prepare: false, max_pipeline: 0 }; // max_pipeline existe no driver, mas falta nos tipos dele
const client = (globalForDb.pg ??= postgres(env.DATABASE_URL, options));

export const db = drizzle(client, { schema });

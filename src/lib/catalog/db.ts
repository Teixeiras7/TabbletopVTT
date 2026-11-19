import "server-only";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { indexCatalog } from "@/lib/engine/character";
import type { Catalog } from "./schemas";

// O catálogo é pequeno (~700 linhas) e só muda com `npm run db:seed`: lido uma vez por processo em produção.
// No `npm run dev` fica em `globalThis` (sobrevive às recargas) e expira em 1 minuto, para um seed aparecer sozinho.
const DEV_TTL = process.env.NODE_ENV === "production" ? Infinity : 60_000;
const store = globalThis as unknown as { catalog?: Promise<Catalog>; catalogAt?: number };

async function load(): Promise<Catalog> {
  const [races, archetypes, skills, abilities, spells, spellLists, careers, connections, actions, [progression], equipment] =
    await Promise.all([
      db.select().from(s.races),
      db.select().from(s.archetypes),
      db.select().from(s.skills),
      db.select().from(s.abilities),
      db.select().from(s.spells),
      db.select().from(s.spellLists),
      db.select().from(s.careers),
      db.select().from(s.connections),
      db.select().from(s.actions),
      db.select().from(s.progression),
      db.select().from(s.equipment),
    ]);
  if (!progression) throw new Error("Catálogo vazio: rode `npm run db:seed`.");
  return { races, archetypes, skills, abilities, spells, spellLists, careers, connections, actions, progression, equipment };
}

export function getCatalog(): Promise<Catalog> {
  if (!store.catalog || Date.now() - (store.catalogAt ?? 0) > DEV_TTL) {
    store.catalogAt = Date.now();
    store.catalog = load().catch((error) => {
      store.catalog = undefined;
      throw error;
    });
  }
  return store.catalog;
}

export async function getCatalogIndex() {
  return indexCatalog(await getCatalog());
}

/** Catálogo enxuto para o assistente de criação (sem os textos longos de perícias e magias nem a Loja, que a tela não usa). */
export async function getCatalogForWizard(): Promise<Catalog> {
  const c = await getCatalog();
  return {
    ...c,
    skills: c.skills.map((s) => ({ ...s, text: "" })),
    spells: c.spells.map((s) => ({ ...s, text: "" })),
    equipment: [],
  };
}

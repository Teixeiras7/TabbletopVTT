import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";

export async function getProfile(userId: string) {
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  return profile ?? null;
}

/** Idempotente: se o perfil já existir (ex. novo login após confirmação de e-mail), não faz nada. */
export async function ensureProfile(userId: string, displayName: string) {
  await db.insert(profiles).values({ id: userId, displayName }).onConflictDoNothing();
}

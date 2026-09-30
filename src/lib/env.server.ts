import "server-only";
import { z } from "zod";
import { clientEnv } from "@/lib/env.client";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
});

const parsed = schema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
});

if (!parsed.success) {
  throw new Error(
    `Variáveis de ambiente de servidor inválidas ou ausentes:\n${parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n")}`,
  );
}

/** Variáveis de ambiente restritas ao servidor (nunca expostas ao cliente). */
export const env = { ...clientEnv, ...parsed.data };

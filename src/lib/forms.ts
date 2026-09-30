import type { ZodError } from "zod";

/** Primeira mensagem de erro por campo, no formato que os formulários exibem. */
export function fieldErrorsOf<K extends string>(error: ZodError): Partial<Record<K, string>> {
  const fieldErrors: Partial<Record<string, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in fieldErrors)) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors as Partial<Record<K, string>>;
}

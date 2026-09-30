import "server-only";
import { headers } from "next/headers";

/**
 * Origem da requisição atual (funciona em localhost, preview e produção na
 * Vercel sem precisar configurar uma URL fixa por ambiente).
 */
export async function getOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");
  return `${protocol}://${host}`;
}

/**
 * Só aceita caminhos internos. Bloqueia URL absoluta, `//host` e `/\host`
 * (navegadores tratam a barra invertida como barra), além de caracteres de
 * controle. Qualquer outra coisa cai no destino padrão.
 */
export function safeRedirectTarget(value: unknown, fallback = "/mesas"): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (
    typeof candidate === "string" &&
    /^\/(?![/\\])/.test(candidate) &&
    !/[\u0000-\u001f]/.test(candidate) &&
    new URL(candidate, "http://internal.invalid").origin === "http://internal.invalid"
  ) {
    return candidate;
  }
  return fallback;
}

import type { Attribute } from "@/lib/catalog/schemas";
import { ATTRIBUTE_LABELS } from "@/lib/engine/character";

const GROUPS: [Attribute, [Attribute, Attribute]][] = [
  ["FIS", ["VEL", "FOR"]],
  ["AGI", ["DES", "MAE"]],
  ["INT", ["ARC", "PER"]],
];
const CX = [105, 300, 495];

/**
 * Atributos como no livro: três primários em círculos grandes e, ligados a cada um por linhas, os dois
 * secundários. ARC aparece tracejado quando o personagem não é Dotado (não tem Arcano).
 */
export function AttributeDiagram({
  attributes,
  limits,
}: {
  attributes: Record<Attribute, number | null>;
  limits: Record<Attribute, number | null>;
}) {
  return (
    <svg viewBox="0 0 600 262" role="img" aria-label="Atributos" className="mx-auto w-full max-w-xl">
      {GROUPS.map(([, secondaries], g) =>
        secondaries.map((s, i) => (
          <line
            key={s}
            x1={CX[g]}
            y1={72}
            x2={(CX[g] ?? 0) + (i === 0 ? -62 : 62)}
            y2={178}
            stroke="var(--muted-foreground)"
            strokeOpacity={attributes[s] === null ? 0.25 : 0.6}
            strokeWidth={2}
            strokeDasharray={attributes[s] === null ? "4 4" : undefined}
          />
        )),
      )}
      {GROUPS.map(([primary, secondaries], g) => {
        const cx = CX[g] ?? 0;
        return (
          <g key={primary}>
            <text x={cx} y={18} textAnchor="middle" fontSize={20} fontWeight={600} fill="var(--foreground)">
              {ATTRIBUTE_LABELS[primary]}
            </text>
            <circle cx={cx} cy={72} r={38} fill="var(--card)" stroke="var(--primary)" strokeWidth={3} />
            <text x={cx} y={84} textAnchor="middle" fontSize={34} fontWeight={700} fill="var(--foreground)">
              {attributes[primary]}
            </text>
            <title>{`${ATTRIBUTE_LABELS[primary]}: ${attributes[primary]} (máx. ${limits[primary]})`}</title>
            <text x={cx} y={128} textAnchor="middle" fontSize={15} fill="var(--muted-foreground)">
              {`máx. ${limits[primary]}`}
            </text>
            {secondaries.map((s, i) => {
              const sx = cx + (i === 0 ? -62 : 62);
              const value = attributes[s];
              return (
                <g key={s}>
                  <circle
                    cx={sx}
                    cy={178}
                    r={27}
                    fill="var(--card)"
                    stroke="var(--muted-foreground)"
                    strokeWidth={value === null ? 1.5 : 2}
                    strokeDasharray={value === null ? "4 4" : undefined}
                    strokeOpacity={value === null ? 0.5 : 1}
                  />
                  <text x={sx} y={187} textAnchor="middle" fontSize={26} fontWeight={600} fill={value === null ? "var(--muted-foreground)" : "var(--foreground)"}>
                    {value ?? "—"}
                  </text>
                  <title>{value === null ? `${ATTRIBUTE_LABELS[s]}: só quem é Dotado tem` : `${ATTRIBUTE_LABELS[s]}: ${value} (máx. ${limits[s]})`}</title>
                  {/* Sigla do livro: o nome inteiro, maior, se sobreporia ao vizinho (fica no title). */}
                  <text x={sx} y={228} textAnchor="middle" fontSize={18} fontWeight={600} fill="var(--foreground)">
                    {s}
                  </text>
                  <text x={sx} y={250} textAnchor="middle" fontSize={14} fill="var(--muted-foreground)">
                    {value === null ? "só Dotado" : `máx. ${limits[s]}`}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

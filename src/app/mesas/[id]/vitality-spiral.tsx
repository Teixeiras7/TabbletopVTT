"use client";

import {
  ATTRIBUTE_LABELS,
  SPIRAL_ASPECTS,
  WEAKENED_EFFECT,
  spiralBranches,
  spiralStatus,
  type SpiralAspect,
} from "@/lib/engine/character";

import { cn } from "@/lib/utils";

export const ASPECT_COLOR: Record<SpiralAspect, string> = {
  FIS: "var(--destructive)",
  AGI: "var(--primary)",
  INT: "oklch(0.66 0.12 250)",
};
const CENTER = 180;
const OUTER = 118;
const STEP = 20;
const RADIUS = 7.5;

const polar = (angleDeg: number, radius: number) => ({
  x: CENTER + radius * Math.cos((angleDeg * Math.PI) / 180),
  y: CENTER + radius * Math.sin((angleDeg * Math.PI) / 180),
});

/**
 * Espiral vital do livro (p. 104, 211): 6 ramos numerados em sentido horário (1-2 Físico, 3-4 Agilidade,
 * 5-6 Intelecto). Cada ramo tem tantos círculos disponíveis quanto o atributo comporta; os que não existem
 * aparecem riscados na ponta de fora. O dano marca de fora para dentro: clicar num círculo marca o dano até
 * ele; clicar no último marcado desfaz.
 */
export function VitalitySpiral({
  vitality,
  marks,
  onMarks,
  compact = false,
  small = false,
}: {
  vitality: Record<SpiralAspect, number>;
  marks: number[];
  onMarks?: (next: number[]) => void;
  /** Menor, com o resumo em coluna ao lado (aba Ficha). */
  compact?: boolean;
  /** Ainda menor e com o resumo embaixo (canto da aba Combate). */
  small?: boolean;
}) {
  const branches = spiralBranches(vitality);
  const status = spiralStatus(branches, marks);

  function toggle(branchIndex: number, circle: number) {
    if (!onMarks) return;
    const next = [...marks];
    next[branchIndex] = marks[branchIndex] === circle + 1 ? circle : circle + 1;
    onMarks(next);
  }

  return (
    <div className={cn(compact && !small ? "flex flex-wrap items-center gap-6" : "space-y-3")}>
      <svg viewBox="0 0 360 360" role="group" aria-label="Espiral vital" className={cn("w-full", small ? "max-w-60" : compact ? "max-w-80" : "mx-auto max-w-sm")}>
        {branches.map((b, i) => {
          const start = -90 + i * 60;
          const edge = polar(start, 150);
          const inner = polar(start, 22);
          return <line key={`sep${b.number}`} x1={inner.x} y1={inner.y} x2={edge.x} y2={edge.y} stroke="var(--border)" strokeWidth={1} />;
        })}
        {SPIRAL_ASPECTS.map((aspect, i) => {
          const p = polar(-90 + i * 120 + 60, 163);
          const st = status.aspects[i]!;
          return (
            <text key={aspect} x={p.x} y={p.y + 4} textAnchor="middle" fontSize={13} fontWeight={600} fill={st.weakened ? "var(--destructive)" : ASPECT_COLOR[aspect]}>
              {ATTRIBUTE_LABELS[aspect]}
            </text>
          );
        })}
        {branches.map((b, i) => {
          const angle = -90 + i * 60 + 30;
          const label = polar(angle, 140);
          const struck = b.drawn - b.capacity;
          return (
            <g key={b.number}>
              <text x={label.x} y={label.y + 4} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)">
                {b.number}
              </text>
              {Array.from({ length: b.drawn }, (_, k) => {
                const p = polar(angle, OUTER - k * STEP);
                if (k < struck) {
                  // círculo que este ramo não tem (riscado de fora para dentro)
                  return (
                    <g key={k} opacity={0.35}>
                      <circle cx={p.x} cy={p.y} r={RADIUS} fill="none" stroke="var(--muted-foreground)" strokeDasharray="2 2" />
                      <line x1={p.x - 5} y1={p.y + 5} x2={p.x + 5} y2={p.y - 5} stroke="var(--muted-foreground)" />
                    </g>
                  );
                }
                const j = k - struck; // 0 = o mais externo disponível
                const marked = j < (marks[i] ?? 0);
                return (
                  <circle
                    key={k}
                    cx={p.x}
                    cy={p.y}
                    r={RADIUS}
                    fill={marked ? "var(--destructive)" : "var(--card)"}
                    stroke={marked ? "var(--destructive)" : ASPECT_COLOR[b.aspect]}
                    strokeWidth={2}
                    className={cn(onMarks && "cursor-pointer")}
                    role={onMarks ? "button" : undefined}
                    tabIndex={onMarks ? 0 : undefined}
                    aria-label={`Ramo ${b.number}, círculo ${j + 1}: ${marked ? "dano marcado" : "livre"}`}
                    onClick={() => toggle(i, j)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggle(i, j);
                      }
                    }}
                  />
                );
              })}
            </g>
          );
        })}
        <text x={CENTER} y={CENTER + 4} textAnchor="middle" fontSize={12} fill="var(--muted-foreground)">
          {status.debilitated ? "debilitado" : ""}
        </text>
      </svg>

      <div className={cn("space-y-2", compact && !small && "min-w-44 max-w-xs flex-1")}>
      <ul className={cn("grid gap-1 text-sm", !compact && "sm:grid-cols-3")}>
        {status.aspects.map((a) => (
          <li key={a.aspect} className={cn("rounded-md border px-3 py-1.5", a.weakened ? "border-destructive/60" : "border-border")}>
            <div className="flex items-baseline justify-between">
              <span className="font-medium">{ATTRIBUTE_LABELS[a.aspect]}</span>
              <span className="tabular-nums">
                {a.remaining}/{a.total}
              </span>
            </div>
            {a.weakened && <div className="text-xs text-destructive">Enfraquecido: {WEAKENED_EFFECT[a.aspect]}</div>}
          </li>
        ))}
      </ul>
      {status.debilitated && <p className="text-sm font-medium text-destructive">Debilitado: sem pontos de vida em nenhum aspecto.</p>}
      </div>
    </div>
  );
}

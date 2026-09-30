import type { MesaRole } from "@/lib/mesas/roles";
import { cn } from "@/lib/utils";

export function RoleBadge({ role }: { role: MesaRole }) {
  const master = role === "master";
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2 py-0.5 text-xs",
        master ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground",
      )}
    >
      {master ? "Mestre" : "Jogador"}
    </span>
  );
}

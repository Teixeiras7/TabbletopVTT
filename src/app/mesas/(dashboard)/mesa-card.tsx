import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { MesaRole } from "@/lib/mesas/roles";
import { RoleBadge } from "@/components/role-badge";
import { MesaSettingsDialog } from "./mesa-settings-dialog";

export type MesaCardData = {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string;
  role: MesaRole;
};

export function MesaCard({ table, origin }: { table: MesaCardData; origin: string }) {
  return (
    <Card className="justify-between">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-base font-semibold">{table.name}</h3>
          <RoleBadge role={table.role} />
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        <p className="inline-flex w-fit rounded-md bg-muted px-2.5 py-1 font-mono text-xs tracking-widest text-foreground">
          {table.inviteCode}
        </p>
        <p className="line-clamp-3 text-sm text-muted-foreground">{table.description || "Sem descrição."}</p>
      </CardContent>

      <div className="flex items-center justify-between px-6">
        <Button asChild size="sm">
          <Link href={`/mesas/${table.id}`}>Entrar</Link>
        </Button>
        {table.role === "master" && (
          <MesaSettingsDialog table={table} inviteLink={`${origin}/mesas?codigo=${table.inviteCode}`} />
        )}
      </div>
    </Card>
  );
}

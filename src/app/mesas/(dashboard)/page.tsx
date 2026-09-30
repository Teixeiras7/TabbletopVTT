import { requireUser } from "@/lib/auth/session";
import { listMyTables } from "@/lib/mesas/queries";
import { normalizeInviteCode } from "@/lib/mesas/invite-code";
import { getOrigin } from "@/lib/site-url";
import { CreateMesaDialog } from "./create-mesa-dialog";
import { JoinMesaDialog } from "./join-mesa-dialog";
import { MesaCard } from "./mesa-card";

export default async function MesasPage({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string }>;
}) {
  const user = await requireUser();
  const [tables, params, origin] = await Promise.all([listMyTables(user.id), searchParams, getOrigin()]);
  const inviteCode = params.codigo ? normalizeInviteCode(params.codigo) : "";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Minhas Mesas</h1>
        <div className="flex gap-3">
          <JoinMesaDialog defaultCode={inviteCode} autoOpen={Boolean(inviteCode)} />
          <CreateMesaDialog />
        </div>
      </div>

      {tables.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium">Você ainda não participa de nenhuma mesa</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Crie uma mesa para ser o Mestre, ou entre em uma com o código de convite que o seu Mestre
            enviou.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tables.map((table) => (
            <MesaCard key={table.id} table={table} origin={origin} />
          ))}
        </div>
      )}
    </main>
  );
}

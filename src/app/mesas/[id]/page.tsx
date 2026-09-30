import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/db/profiles";
import { listChatForMember } from "@/lib/mesas/chat";
import { listInfosForMember } from "@/lib/mesas/infos";
import { getSceneForMember, getTableForMember } from "@/lib/mesas/queries";
import { mesaIdSchema } from "@/lib/mesas/schemas";
import { getOrigin } from "@/lib/site-url";
import { TableCanvas } from "./table-canvas-loader";
import { MesaSidebar } from "./mesa-sidebar";

export default async function MesaPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!mesaIdSchema.safeParse(id).success) notFound();

  const lobby = await getTableForMember(id, user.id);
  if (!lobby) notFound();
  const { table, role, members } = lobby;

  const [scene, profile, origin, chatMessages, infoList] = await Promise.all([
    getSceneForMember(id, user.id),
    getProfile(user.id),
    getOrigin(),
    listChatForMember(id, user.id),
    listInfosForMember(id, user.id),
  ]);

  const displayName = profile?.displayName ?? user.email ?? "Jogador";
  const inviteLink = `${origin}/mesas?codigo=${table.inviteCode}`;

  return (
    <div className="flex h-dvh">
      <div className="relative min-w-0 flex-1">
        {scene ? (
          <TableCanvas
            sceneId={scene.scene.id}
            gridSize={scene.scene.gridSize}
            backgroundUrl={scene.scene.backgroundUrl}
            initialTokens={scene.tokens}
            isMaster={role === "master"}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Mapa indisponível para esta mesa.
          </div>
        )}
      </div>

      {scene && (
        <MesaSidebar
          table={table}
          role={role}
          members={members}
          currentUserId={user.id}
          displayName={displayName}
          inviteLink={inviteLink}
          scene={{
            id: scene.scene.id,
            gridSize: scene.scene.gridSize,
            backgroundUrl: scene.scene.backgroundUrl,
          }}
          initialMessages={chatMessages ?? []}
          initialInfos={infoList ?? []}
        />
      )}
    </div>
  );
}

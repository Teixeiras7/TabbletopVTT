import Link from "next/link";
import { logoutAction } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/db/profiles";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

// Este cabeçalho só existe para Minhas Mesas — a página de dentro de uma
// mesa (`/mesas/[id]`) fica fora deste grupo de rotas de propósito, para o
// mapa poder ocupar a tela inteira sem essa barra em cima.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const profile = await getProfile(user.id);

  return (
    <div className="min-h-dvh">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <Link href="/mesas" className="text-sm font-semibold tracking-wide">
            Reinos de Ferro
          </Link>
          <div className="flex items-center gap-3">
            <span className="max-w-40 truncate text-sm text-muted-foreground sm:max-w-none">
              {profile?.displayName ?? user.email}
            </span>
            <ThemeToggle />
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="sm">
                Sair
              </Button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

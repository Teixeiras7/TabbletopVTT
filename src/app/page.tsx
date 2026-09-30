import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Reinos de Ferro VTT</h1>
      <p className="max-w-sm text-sm text-neutral-400">
        Mesa virtual para Reinos de Ferro. Funcionalidades de mesa ainda não
        foram implementadas.
      </p>
      {user ? (
        <Link
          href="/mesas"
          className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900"
        >
          Ir para Minhas Mesas
        </Link>
      ) : (
        <div className="flex gap-3">
          <Link
            href="/login"
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-200"
          >
            Entrar
          </Link>
          <Link
            href="/cadastro"
            className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900"
          >
            Criar conta
          </Link>
        </div>
      )}
    </main>
  );
}

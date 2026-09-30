import Link from "next/link";

export default function MesaNotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Mesa não encontrada</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Ela não existe mais ou você não participa dela.
      </p>
      <Link
        href="/mesas"
        className="mt-6 inline-block rounded-md border border-neutral-700 px-4 py-2 text-sm hover:border-neutral-500"
      >
        Voltar para Minhas Mesas
      </Link>
    </main>
  );
}

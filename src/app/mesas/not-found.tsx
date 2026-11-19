import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function MesaNotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Mesa não encontrada</h1>
      <p className="mt-2 text-sm text-muted-foreground">Ela não existe mais ou você não participa dela.</p>
      <Link href="/mesas" className={buttonVariants({ variant: "outline", className: "mt-6" })}>
        Voltar para Minhas Mesas
      </Link>
    </main>
  );
}

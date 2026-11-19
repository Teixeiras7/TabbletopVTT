import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentUser } from "@/lib/auth/session";
import { SignUpForm } from "./signup-form";

export default async function CadastroPage() {
  if (await getCurrentUser()) redirect("/mesas");

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,color-mix(in_oklch,var(--primary)_18%,transparent),transparent)]"
      />
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="relative w-full max-w-sm shadow-2xl shadow-black/40">
        <CardHeader>
          <CardTitle>Criar conta</CardTitle>
          <CardDescription>Crie sua conta para jogar Reinos de Ferro com seu grupo.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignUpForm />
        </CardContent>
      </Card>
    </main>
  );
}

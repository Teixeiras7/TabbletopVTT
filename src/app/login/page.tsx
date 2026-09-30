import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { safeRedirectTarget } from "@/lib/auth/redirect";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/mesas");
  }

  const params = await searchParams;
  const redirectTo = safeRedirectTarget(params.redirectTo);
  const notice =
    params.error === "confirm_failed"
      ? "Não foi possível confirmar seu e-mail. O link pode ter expirado — tente se cadastrar novamente."
      : undefined;

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
          <CardTitle>Entrar</CardTitle>
          <CardDescription>Entre para acessar suas mesas de Reinos de Ferro.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm redirectTo={redirectTo} notice={notice} />
        </CardContent>
      </Card>
    </main>
  );
}

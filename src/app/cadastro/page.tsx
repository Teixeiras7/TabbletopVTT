import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { SignUpForm } from "./signup-form";

export default async function CadastroPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/mesas");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-xl font-semibold">Criar conta</h1>
      <SignUpForm />
    </main>
  );
}

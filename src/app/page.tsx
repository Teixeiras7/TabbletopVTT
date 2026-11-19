import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

/** Sem página inicial própria: quem está logado vai às mesas; os demais, ao login. */
export default async function Home() {
  redirect((await getCurrentUser()) ? "/mesas" : "/login");
}

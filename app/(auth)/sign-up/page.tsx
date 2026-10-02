import { SignUpForm } from "./sign-up-form";
import { getSignupMode } from "@/lib/signup-mode";

// Le mode d’inscription doit refléter la configuration actuelle, pas le build.
export const dynamic = "force-dynamic";

export const metadata = { title: "Créer un espace" };

export default async function SignUpPage() {
  const mode = await getSignupMode();
  return <SignUpForm mode={mode} />;
}

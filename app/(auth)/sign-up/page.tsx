import { SignUpForm } from "./sign-up-form";
import { getSignupMode } from "@/lib/signup-mode";

export const metadata = { title: "Créer un espace" };

export default async function SignUpPage() {
  const mode = await getSignupMode();
  return <SignUpForm mode={mode} />;
}

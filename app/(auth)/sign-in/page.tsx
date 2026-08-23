import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Connexion" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <SignInForm next={next} />;
}

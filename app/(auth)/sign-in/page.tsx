import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Connexion" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const actSsoEnabled = Boolean(
    (process.env.ACT_SSO_ISSUER ?? "").trim() && (process.env.ACT_SSO_CLIENT_ID ?? "").trim(),
  );
  return <SignInForm next={next} actError={error} actSsoEnabled={actSsoEnabled} />;
}

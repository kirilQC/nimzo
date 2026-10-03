import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  not_allowed: "That account isn't allowed to use Nimzo.",
  link: "That sign-in link expired or was already used. Request a new one.",
  owner: "Signed in, but the owner record couldn't be saved. Check SUPABASE_SECRET_KEY.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="card w-full max-w-[400px] p-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.svg" width={120} height={120} alt="Nimzo" className="mx-auto" />
        <h1 className="mt-5 text-2xl">Welcome back</h1>
        <p className="mt-1 text-body2">Sign in with a one-time email link.</p>
        {message && (
          <p role="alert" className="mt-4 rounded-[8px] bg-chip px-3 py-2 text-sm text-ink">
            {message}
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}

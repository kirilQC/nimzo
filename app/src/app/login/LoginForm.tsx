"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, { status: "idle" });
  if (state.status === "sent") {
    return (
      <p role="status" className="mt-6 text-body2">
        {state.message}
      </p>
    );
  }
  return (
    <form action={action} className="mt-6 space-y-3 text-left">
      <label htmlFor="email" className="block text-sm font-semibold text-body2">
        Email
      </label>
      <input id="email" name="email" type="email" required autoComplete="email" className="input" />
      {state.status === "error" && (
        <p role="alert" className="text-sm text-[color:var(--blunder-bg)]">
          {state.message}
        </p>
      )}
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}

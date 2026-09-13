"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useData } from "@/components/DataProvider";
import { Field, TextInput } from "@/components/ui";

/** Friendlier wording than Firebase's raw codes. */
function describe(error: unknown): string {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  switch (code) {
    case "auth/invalid-email":
      return "That email address does not look right.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Wrong email or password.";
    case "auth/too-many-requests":
      return "Too many tries. Wait a minute and try again.";
    case "auth/network-request-failed":
      return "No internet connection.";
    default:
      return error instanceof Error ? error.message : "Could not sign in.";
  }
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const { user, authResolved, configError, signIn } = useData();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (configError) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-lg font-semibold">Not set up yet</h1>
        <p className="mt-2 text-sm text-muted">{configError}</p>
        <p className="mt-4 text-sm text-muted">
          The steps are in the README under “Setting up the database”.
        </p>
      </main>
    );
  }

  if (!authResolved) {
    return <p className="px-4 py-16 text-center text-sm text-muted">Loading…</p>;
  }

  if (user) return <>{children}</>;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signIn(email, password);
    } catch (cause) {
      setError(describe(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-xl font-bold">Invoice &amp; Quotation</h1>
      <p className="mt-1 text-sm text-muted">Sign in to see your jobs.</p>

      <form onSubmit={submit} className="mt-6 space-y-3">
        <Field label="Email">
          <TextInput
            type="email"
            autoComplete="username"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>
        <Field label="Password">
          <TextInput
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Field>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

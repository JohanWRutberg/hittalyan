"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signUp } from "@/lib/auth-client";
import { FadeIn } from "@/components/motion";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    if (password.length < 8) {
      setError("Lösenordet måste vara minst 8 tecken.");
      return;
    }
    setLoading(true);
    const { error } = await signUp.email({
      name: String(form.get("name")),
      email: String(form.get("email")),
      password,
    });
    setLoading(false);
    if (error) {
      setError(error.code === "USER_ALREADY_EXISTS" ? "Det finns redan ett konto med den e-posten." : (error.message ?? "Något gick fel."));
      return;
    }
    router.push("/app/konto?ny=1");
    router.refresh();
  }

  return (
    <FadeIn>
      <h1 className="text-2xl font-bold tracking-tight">Skapa konto</h1>
      <p className="mt-1 text-sm text-muted">Notiserna skickas till e-posten du anger här.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="name">Namn</label>
          <input id="name" name="name" autoComplete="name" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="email">E-post</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="password">Lösenord (minst 8 tecken)</label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="input" />
        </div>
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Skapar konto…" : "Skapa konto"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Har du redan konto?{" "}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Logga in
        </Link>
      </p>
    </FadeIn>
  );
}

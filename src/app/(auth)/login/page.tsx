"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LockKeyhole, ShieldCheck, Shirt, UserRoundCog } from "lucide-react";

const demoUsers = [
  {
    role: "Cutting Supervisor",
    email: "supervisor@apparelflow.demo",
    password: "Supervisor#2026",
    icon: ShieldCheck,
  },
  {
    role: "Cutting Verifier",
    email: "verifier@apparelflow.demo",
    password: "Verifier#2026",
    icon: LockKeyhole,
  },
  {
    role: "Sewing Supervisor",
    email: "sewing@apparelflow.demo",
    password: "Sewing#2026",
    icon: Shirt,
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("supervisor@apparelflow.demo");
  const [password, setPassword] = useState("Supervisor#2026");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error?.message ?? "Unable to sign in.");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to sign in.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="woven-surface min-h-screen text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-7xl items-stretch gap-6 px-4 py-4 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:py-8">
        <section className="relative min-h-[560px] overflow-hidden rounded-[2rem] bg-slate-950 p-8 text-white ink-shadow sm:p-12">
          <img
            src="https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=1600&q=85"
            alt="Neatly arranged rolls of colorful textile fabric"
            className="absolute inset-0 h-full w-full object-cover opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-indigo-950/20" />
          <div className="relative flex h-full flex-col justify-between">
          <div className="mb-8 inline-flex w-fit items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-sm font-medium text-indigo-100 backdrop-blur">
            <UserRoundCog size={16} />
            ApparelFlow ERP — GateLine
          </div>

          <div>
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-white sm:text-6xl">
            Cutting gatekeeper terminal for live production verification.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-200">
            Keep the sewing queue physically locked until every component is
            validated and approved by the cutting verifier.
          </p>
          </div>

          <div className="mt-10 grid gap-3 border-t border-white/20 pt-5 sm:grid-cols-3">
            {demoUsers.map(
              ({ role, email, password: demoPassword, icon: Icon }) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    setEmail(email);
                    setPassword(demoPassword);
                  }}
                  className="rounded-2xl border border-white/15 bg-white/10 p-4 text-left backdrop-blur transition hover:border-indigo-200 hover:bg-white/20"
                >
                  <div className="mb-3 inline-flex rounded-xl bg-white/90 p-2 text-indigo-700 shadow-sm">
                    <Icon size={18} />
                  </div>
                  <p className="text-sm font-semibold text-white">{role}</p>
                  <p className="mt-2 text-xs text-slate-300">{email}</p>
                </button>
              ),
            )}
          </div>
          </div>
        </section>

        <section className="flex items-center rounded-[2rem] border border-slate-200 bg-white p-8 ink-shadow sm:p-12">
          <div className="w-full">
          <div className="mb-6">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
              Sign in
            </p>
            <h2 className="mt-3 text-3xl font-bold text-slate-900">
              Welcome back
            </h2>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-medium text-slate-700"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none ring-0 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                placeholder="you@company.com"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-slate-700"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none ring-0 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                placeholder="Enter password"
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-indigo-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <div className="mt-8 flex items-center gap-3 border-t border-slate-200 pt-5 text-xs text-slate-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Secure session · Supabase-backed production data
          </div>
          </div>
        </section>
      </div>
    </main>
  );
}

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
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
            <UserRoundCog size={16} />
            ApparelFlow ERP — GateLine
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            Cutting gatekeeper terminal for live production verification.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-slate-600">
            Keep the sewing queue physically locked until every component is
            validated and approved by the cutting verifier.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {demoUsers.map(
              ({ role, email, password: demoPassword, icon: Icon }) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    setEmail(email);
                    setPassword(demoPassword);
                  }}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-indigo-300 hover:bg-indigo-50"
                >
                  <div className="mb-3 inline-flex rounded-xl bg-white p-2 text-indigo-700 shadow-sm">
                    <Icon size={18} />
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{role}</p>
                  <p className="mt-2 text-xs text-slate-500">{email}</p>
                </button>
              ),
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
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
        </section>
      </div>
    </main>
  );
}

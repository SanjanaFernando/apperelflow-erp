import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-10 text-slate-900">
      <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900">
          ApparelFlow ERP foundation is live.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-600">
          The project now includes the Next.js app shell, demo-auth routes, and
          the GateLine UI frame that the production verification workflow is
          built around.
        </p>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/login"
            className="rounded-xl bg-indigo-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-800"
          >
            Open sign-in
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            View dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

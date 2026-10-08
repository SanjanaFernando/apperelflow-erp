"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ClipboardList,
  Factory,
  LockKeyhole,
  Shirt,
  ShieldCheck,
} from "lucide-react";
import { LoadingState } from "@/components/ui/loading-state";

const metricCards = [
  { label: "Orders in cutting", value: 18, icon: Factory },
  { label: "Awaiting QC", value: 5, icon: ClipboardList },
  { label: "Rejected", value: 2, icon: LockKeyhole },
  { label: "Verified today", value: 12, icon: Activity },
];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [orders, setOrders] = useState<
    Array<{
      id: string;
      orderNo: string;
      recipeCode: string;
      targetQty: number;
      status: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const meResponse = await fetch("/api/auth/me");

        if (!meResponse.ok) {
          router.push("/login");
          return;
        }

        const meData = await meResponse.json();
        setUser(meData.user);

        const ordersResponse = await fetch("/api/orders");
        if (ordersResponse.ok) {
          const ordersData = await ordersResponse.json();
          setOrders(ordersData.orders ?? []);
        }
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (loading) {
    return <LoadingState label="Loading production control room" />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 p-8 text-slate-700">
        Not authenticated.
      </div>
    );
  }

  return (
    <main className="woven-surface min-h-screen p-4 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="relative overflow-hidden rounded-2xl border border-indigo-900/20 bg-indigo-950 p-6 text-white shadow-xl sm:p-8">
          <div className="absolute -right-20 -top-32 h-72 w-72 rounded-full border-[32px] border-indigo-500/20" />
          <div className="relative flex flex-wrap items-center justify-between gap-5">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-indigo-200">
                GateLine / Live operations
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                Production control room
              </h1>
              <p className="mt-2 max-w-xl text-sm text-indigo-100">
                Track every batch from cutting floor to sewing release.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-indigo-100 backdrop-blur">
                {user.role}
              </div>
              {user.role === "cutting_verifier" && (
                <a
                  href="/verification"
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-800"
                >
                  <ShieldCheck size={16} />
                  Open QC terminal
                </a>
              )}
              {user.role === "sewing_supervisor" && (
                <a
                  href="/sewing"
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-800"
                >
                  <Factory size={16} />
                  Open sewing floor
                </a>
              )}
              {user.role === "cutting_supervisor" && (
                <a
                  href="/cutting"
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-800"
                >
                  <Factory size={16} />
                  Open cutting floor
                </a>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl border border-white/20 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-indigo-50"
              >
                Log out
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          {metricCards.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">{label}</p>
                <div className="rounded-lg bg-indigo-50 p-2 text-indigo-700">
                  <Icon size={18} />
                </div>
              </div>
              <p className="mt-4 text-3xl font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                Orders in work
              </h2>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                Live
              </span>
            </div>

            <div className="space-y-3">
              {orders.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                  No orders yet. Create one from the supervisor flow to populate
                  the queue.
                </div>
              ) : (
                orders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {order.orderNo}
                      </p>
                      <p className="text-sm text-slate-500">
                        {order.recipeCode} · {order.targetQty} units
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {order.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Role focus</h2>
            <div className="mt-5 space-y-4">
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                <div className="rounded-lg bg-indigo-100 p-2 text-indigo-700">
                  <Shirt size={18} />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Production lock</p>
                  <p className="text-sm text-slate-500">
                    Sewing remains blocked until verification passes.
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                Demo user:{" "}
                <span className="font-medium text-slate-700">{user.name}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

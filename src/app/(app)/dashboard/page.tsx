"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ClipboardList,
  Factory,
  LockKeyhole,
  Shirt,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { LoadingState } from "@/components/ui/loading-state";
import { Input } from "@/components/ui/input";

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
      fabricRollId: string;
    }>
  >([]);
  const [metrics, setMetrics] = useState({
    ordersInCutting: 0,
    awaitingQc: 0,
    rejected: 0,
    verifiedToday: 0,
  });
  const [selectedMetric, setSelectedMetric] = useState<
    "cutting" | "qc" | "rejected" | "verified" | null
  >(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [meResponse, ordersResponse, metricsResponse] = await Promise.all(
          [
            fetch("/api/auth/me"),
            fetch("/api/orders"),
            fetch("/api/orders/metrics"),
          ],
        );

        if (!meResponse.ok) {
          router.push("/login");
          return;
        }

        const meData = await meResponse.json();
        setUser(meData.user);

        if (ordersResponse.ok) {
          const ordersData = await ordersResponse.json();
          setOrders(ordersData.orders ?? []);
        }
        if (metricsResponse.ok) {
          const metricsData = await metricsResponse.json();
          setMetrics(metricsData.metrics);
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

  const metricCards = [
    {
      key: "cutting" as const,
      label: "Orders in cutting",
      value: metrics.ordersInCutting,
      icon: Factory,
      statuses: ["CUTTING_IN_PROGRESS"],
    },
    {
      key: "qc" as const,
      label: "Awaiting QC",
      value: metrics.awaitingQc,
      icon: ClipboardList,
      statuses: ["PENDING_VERIFICATION"],
    },
    {
      key: "rejected" as const,
      label: "Rejected",
      value: metrics.rejected,
      icon: LockKeyhole,
      statuses: ["REJECTED"],
    },
    {
      key: "verified" as const,
      label: "Verified today",
      value: metrics.verifiedToday,
      icon: Activity,
      statuses: ["VERIFIED", "SEWING_IN_PROGRESS"],
    },
  ];
  const selectedMetricDefinition = metricCards.find(
    (metric) => metric.key === selectedMetric,
  );
  const visibleOrders = selectedMetricDefinition
    ? orders.filter((order) =>
        selectedMetricDefinition.statuses.includes(order.status),
      )
    : orders;
  const searchedOrders = visibleOrders.filter((order) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return [
      order.orderNo,
      order.recipeCode,
      order.fabricRollId,
      order.status,
      String(order.targetQty),
    ].some((value) => value.toLowerCase().includes(query));
  });

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
          {metricCards.map(({ key, label, value, icon: Icon }) => (
            <button
              key={label}
              type="button"
              onClick={() =>
                setSelectedMetric(selectedMetric === key ? null : key)
              }
              className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${selectedMetric === key ? "border-indigo-500 ring-2 ring-indigo-100" : "border-slate-200"}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">{label}</p>
                <div className="rounded-lg bg-indigo-50 p-2 text-indigo-700">
                  <Icon size={18} />
                </div>
              </div>
              <p className="mt-4 text-3xl font-bold text-slate-900">{value}</p>
              <p className="mt-2 text-xs font-medium text-indigo-700">
                View matching orders
              </p>
            </button>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {selectedMetric
                    ? metricCards.find(
                        (metric) => metric.key === selectedMetric,
                      )?.label
                    : "Orders in work"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {searchedOrders.length} matching order
                  {searchedOrders.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  Live
                </span>
                {selectedMetric && (
                  <button
                    type="button"
                    aria-label="Clear metric filter"
                    onClick={() => setSelectedMetric(null)}
                    className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>

            <div className="relative mb-4">
              <Search
                className="pointer-events-none absolute left-3 top-2.5 text-slate-400"
                size={17}
              />
              <Input
                aria-label="Search orders"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search order, recipe, roll, status..."
                className="pl-9"
              />
            </div>

            <div className="space-y-3">
              {searchedOrders.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                  No orders yet. Create one from the supervisor flow to populate
                  the queue.
                </div>
              ) : (
                searchedOrders.map((order) => (
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

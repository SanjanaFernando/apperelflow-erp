"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Factory,
  Lock,
  Play,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { BackButton } from "@/components/ui/back-button";

type SewingOrder = {
  id: string;
  orderNo: string;
  recipeCode: string;
  targetQty: number;
  fabricRollId: string;
  actualFabricYds: number;
  status: "VERIFIED" | "SEWING_IN_PROGRESS";
  items: Array<{
    id: string;
    componentName: string;
    expectedQty: number;
    actualQty: number | null;
    variance: number | null;
  }>;
  approval: {
    verifierName: string;
    verifiedAt: string;
    wastagePct: number | null;
    componentVariances: unknown;
  } | null;
};

type Tab = "ready" | "active";

export default function SewingPage() {
  const router = useRouter();
  const [ready, setReady] = useState<SewingOrder[]>([]);
  const [active, setActive] = useState<SewingOrder[]>([]);
  const [tab, setTab] = useState<Tab>("ready");
  const [selected, setSelected] = useState<SewingOrder | null>(null);
  const [confirmStart, setConfirmStart] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadQueue() {
    const [queueResponse, activeResponse] = await Promise.all([
      fetch("/api/sewing/queue"),
      fetch("/api/sewing/active"),
    ]);
    if (queueResponse.status === 401) {
      router.push("/login");
      return;
    }
    if (queueResponse.status === 403 || activeResponse.status === 403) {
      setError("Not permitted for your role.");
      setLoading(false);
      return;
    }
    const queueData = await queueResponse.json();
    const activeData = await activeResponse.json();
    setReady(queueData.orders ?? []);
    setActive(activeData.orders ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void loadQueue();
  }, []);

  const orders = tab === "ready" ? ready : active;

  async function startOrder() {
    if (!selected) return;
    const response = await fetch(`/api/sewing/orders/${selected.id}/start`, {
      method: "POST",
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error?.message ?? "Unable to start sewing.");
      setConfirmStart(false);
      return;
    }
    setConfirmStart(false);
    setSelected(null);
    setTab("active");
    await loadQueue();
  }

  if (loading) return <LoadingState label="Loading sewing floor" />;
  if (error === "Not permitted for your role.")
    return (
      <main className="min-h-screen bg-slate-100 p-8 text-slate-900">
        <Card>
          <CardContent>
            <h1 className="text-xl font-bold">Not permitted for your role</h1>
            <p className="mt-2 text-slate-600">
              Only sewing supervisors can access the production floor.
            </p>
          </CardContent>
        </Card>
      </main>
    );

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="relative overflow-hidden rounded-2xl border border-indigo-900/20 bg-indigo-950 p-6 text-white shadow-xl sm:p-8">
          <div className="absolute -right-20 -top-32 h-72 w-72 rounded-full border-[32px] border-indigo-500/20" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <BackButton />
              <div>
                <div className="flex items-center gap-2 text-indigo-200">
                  <Factory size={18} />
                  <p className="text-sm font-semibold uppercase tracking-[0.18em]">
                    GateLine / Sewing floor
                  </p>
                </div>
                <h1 className="mt-2 text-3xl font-bold tracking-tight">
                  Assembly queue
                </h1>
                <p className="mt-1 text-indigo-100">
                  Only QC-verified batches appear here.
                </p>
              </div>
            </div>
            <Button
              className="gap-2 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              onClick={() => void loadQueue()}
            >
              <RefreshCw size={16} />
              Refresh floor
            </Button>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-800"
          >
            {error}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-3">
          <Card className="border-indigo-200 bg-indigo-50">
            <CardContent>
              <p className="text-sm font-medium text-indigo-800">
                Ready for sewing
              </p>
              <p className="mt-2 text-3xl font-bold text-indigo-950">
                {ready.length}
              </p>
            </CardContent>
          </Card>
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent>
              <p className="text-sm font-medium text-emerald-800">
                In assembly
              </p>
              <p className="mt-2 text-3xl font-bold text-emerald-950">
                {active.length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm font-medium text-slate-600">
                Control status
              </p>
              <p className="mt-2 flex items-center gap-2 font-semibold text-slate-900">
                <Lock size={16} />
                QC gate enforced
              </p>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">Production batches</h2>
              <p className="mt-1 text-sm text-slate-500">
                Select a batch to inspect its approval record.
              </p>
            </div>
            <div
              className="flex rounded-lg border border-slate-300 bg-slate-50 p-1"
              role="tablist"
              aria-label="Sewing batch status"
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab === "ready"}
                onClick={() => setTab("ready")}
                className={`rounded-md px-3 py-2 text-sm font-semibold ${tab === "ready" ? "bg-white text-indigo-800 shadow-sm" : "text-slate-600"}`}
              >
                Ready <span className="ml-1 tabular-nums">{ready.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "active"}
                onClick={() => setTab("active")}
                className={`rounded-md px-3 py-2 text-sm font-semibold ${tab === "active" ? "bg-white text-indigo-800 shadow-sm" : "text-slate-600"}`}
              >
                In assembly{" "}
                <span className="ml-1 tabular-nums">{active.length}</span>
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-center">
                <CheckCircle2 size={36} className="text-slate-400" />
                <h3 className="mt-3 font-semibold">
                  {tab === "ready"
                    ? "No verified batches yet"
                    : "No batches in assembly"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Approved cutting batches will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {orders.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => setSelected(order)}
                    className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-950">
                          {order.orderNo}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {order.recipeCode} · {order.targetQty} units
                        </p>
                      </div>
                      <Badge
                        className={
                          order.status === "VERIFIED"
                            ? "bg-indigo-100 text-indigo-800"
                            : "bg-emerald-100 text-emerald-800"
                        }
                      >
                        {order.status === "VERIFIED" ? "READY" : "ACTIVE"}
                      </Badge>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
                      <div>
                        <p className="text-slate-500">Verified by</p>
                        <p className="mt-1 font-medium">
                          {order.approval?.verifierName ?? "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Wastage</p>
                        <p className="mt-1 font-medium">
                          {order.approval?.wastagePct?.toFixed(2) ?? "—"}%
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-slate-950/30"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inspector-title"
        >
          <aside className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">
                  Batch inspector
                </p>
                <h2 id="inspector-title" className="mt-2 text-2xl font-bold">
                  {selected.orderNo}
                </h2>
                <p className="mt-1 text-slate-600">
                  {selected.recipeCode} · {selected.targetQty} garments
                </p>
              </div>
              <Button
                aria-label="Close batch inspector"
                className="px-2 text-slate-500 hover:bg-slate-100"
                onClick={() => setSelected(null)}
              >
                <X size={18} />
              </Button>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <Card className="bg-slate-50">
                <CardContent>
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    Verifier
                  </p>
                  <p className="mt-2 font-semibold">
                    {selected.approval?.verifierName ?? "—"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {selected.approval
                      ? new Date(selected.approval.verifiedAt).toLocaleString()
                      : "No approval record"}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-slate-50">
                <CardContent>
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    Fabric wastage
                  </p>
                  <p className="mt-2 text-2xl font-bold">
                    {selected.approval?.wastagePct?.toFixed(2) ?? "—"}%
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Roll {selected.fabricRollId}
                  </p>
                </CardContent>
              </Card>
            </div>
            <Card className="mt-6">
              <CardHeader>
                <h3 className="font-semibold">Verified component counts</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                {selected.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium">{item.componentName}</p>
                      <p className="text-sm text-slate-500">
                        Expected {item.expectedQty}
                      </p>
                    </div>
                    <p className="font-semibold tabular-nums">
                      {item.actualQty ?? "—"}{" "}
                      <span className="ml-1 text-sm font-normal text-slate-500">
                        ({item.variance && item.variance > 0 ? "+" : ""}
                        {item.variance ?? "—"})
                      </span>
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
            {selected.status === "VERIFIED" && (
              <Button
                className="mt-6 w-full bg-indigo-700 text-white hover:bg-indigo-800"
                onClick={() => setConfirmStart(true)}
              >
                <Play size={16} className="mr-2" />
                Start sewing assembly
              </Button>
            )}
            {selected.status === "SEWING_IN_PROGRESS" && (
              <div className="mt-6 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
                <ShieldCheck size={18} />
                Assembly is currently in progress.
              </div>
            )}
          </aside>
        </div>
      )}
      {confirmStart && selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-start-title"
        >
          <Card className="w-full max-w-md">
            <CardHeader>
              <h2 id="confirm-start-title" className="text-lg font-semibold">
                Start sewing assembly?
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {selected.orderNo} will move from Ready for Sewing to In
                Assembly.
              </p>
            </CardHeader>
            <CardContent className="flex justify-end gap-3">
              <Button
                className="border border-slate-300 bg-white text-slate-700"
                onClick={() => setConfirmStart(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-indigo-700 text-white hover:bg-indigo-800"
                onClick={() => void startOrder()}
              >
                Confirm start
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}

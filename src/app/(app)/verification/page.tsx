"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  History,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { BackButton } from "@/components/ui/back-button";
import { Textarea } from "@/components/ui/textarea";
import { classifyItem, computeWastage } from "@/server/domain/verification";

type OrderItem = {
  id: string;
  componentId: string;
  componentName: string;
  expectedQty: number;
  actualQty: number | null;
  status: "GREEN" | "YELLOW" | "RED" | null;
};

type VerificationOrder = {
  id: string;
  orderNo: string;
  recipeCode: string;
  targetQty: number;
  fabricRollId: string;
  actualFabricYds: number;
  status: string;
  items: OrderItem[];
};

type History = {
  logs: Array<{
    id: string;
    decision: string;
    rejectionNote: string | null;
    timestamp: string;
    verifier: { fullName: string };
    wastagePct: number | null;
  }>;
  events: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    at: string;
  }>;
};

function statusStyle(status: OrderItem["status"]) {
  if (status === "GREEN") return "bg-emerald-100 text-emerald-800";
  if (status === "YELLOW") return "bg-amber-100 text-amber-900";
  if (status === "RED") return "bg-red-100 text-red-800";
  return "bg-slate-100 text-slate-700";
}

export default function VerificationPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<VerificationOrder[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [order, setOrder] = useState<VerificationOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [history, setHistory] = useState<History | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  async function loadOrders() {
    const response = await fetch("/api/orders?status=PENDING_VERIFICATION");
    if (response.status === 401) {
      router.push("/login");
      return;
    }
    if (response.status === 403) {
      setError("Not permitted for your role.");
      setLoading(false);
      return;
    }
    const data = await response.json();
    setOrders(data.orders ?? []);
    setSelectedId((current) => current ?? data.orders?.[0]?.id ?? null);
    setLoading(false);
  }

  async function loadOrder(id: string) {
    const response = await fetch(`/api/orders/${id}`);
    if (!response.ok) return;
    const data = await response.json();
    setOrder(data.order);
  }

  useEffect(() => {
    void loadOrders();
  }, []);

  useEffect(() => {
    if (selectedId) void loadOrder(selectedId);
  }, [selectedId]);

  const blockers = useMemo(() => {
    if (!order) return [];
    return order.items.flatMap((item) => {
      if (item.actualQty === null)
        return [`${item.componentName} is uncounted`];
      if (item.actualQty < item.expectedQty) {
        return [
          `${item.componentName} is short by ${item.expectedQty - item.actualQty}`,
        ];
      }
      return [];
    });
  }, [order]);

  function updateCount(item: OrderItem, value: string) {
    if (!order || (value !== "" && !/^\d+$/.test(value))) return;
    const actualQty = value === "" ? null : Number(value);
    setOrder({
      ...order,
      items: order.items.map((entry) =>
        entry.componentId === item.componentId
          ? {
              ...entry,
              actualQty,
              status:
                actualQty === null
                  ? null
                  : classifyItem(entry.expectedQty, actualQty),
            }
          : entry,
      ),
    });
    if (actualQty === null) return;
    window.setTimeout(() => {
      void fetch(`/api/orders/${order.id}/counts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ componentId: item.componentId, actualQty }),
      });
    }, 350);
  }

  async function approve() {
    if (!order || blockers.length > 0) return;
    setError("");
    const response = await fetch(`/api/orders/${order.id}/approve`, {
      method: "POST",
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error?.message ?? "Approval failed.");
      return;
    }
    await loadOrders();
    setOrder(null);
    setSelectedId(null);
  }

  async function reject() {
    if (!order) return;
    if (note.trim().length < 10) {
      setError("Reason must be at least 10 characters.");
      return;
    }
    const response = await fetch(`/api/orders/${order.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error?.message ?? "Rejection failed.");
      return;
    }
    setShowReject(false);
    setNote("");
    await loadOrders();
    setOrder(null);
    setSelectedId(null);
  }

  async function openHistory() {
    if (!order) return;
    const response = await fetch(`/api/orders/${order.id}/history`);
    if (response.ok) {
      setHistory(await response.json());
      setShowHistory(true);
    }
  }

  if (loading) return <LoadingState label="Loading verification terminal" />;
  if (error === "Not permitted for your role.")
    return (
      <main className="min-h-screen bg-slate-100 p-8 text-slate-900">
        <Card>
          <CardContent>
            <h1 className="text-xl font-bold">Not permitted for your role</h1>
            <p className="mt-2 text-slate-600">
              Only cutting verifiers can access the QC terminal.
            </p>
          </CardContent>
        </Card>
      </main>
    );

  const wastage = order
    ? computeWastage(
        order.actualFabricYds,
        order.targetQty,
        order.targetQty ? order.actualFabricYds / order.targetQty : 0,
      )
    : 0;

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="relative overflow-hidden rounded-2xl border border-indigo-900/20 bg-indigo-950 p-6 text-white shadow-xl sm:p-8">
          <div className="absolute -right-20 -top-32 h-72 w-72 rounded-full border-[32px] border-indigo-500/20" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <BackButton />
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-200">
                  GateLine / Quality control
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight">
                  Verifier terminal
                </h1>
                <p className="mt-1 text-indigo-100">
                  Every shortage blocks approval. Overages are recorded for
                  review.
                </p>
              </div>
            </div>
            <Button
              className="gap-2 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              onClick={() => void loadOrders()}
            >
              <RefreshCw size={16} />
              Refresh inbox
            </Button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <h2 className="font-semibold">QC inbox</h2>
              <p className="mt-1 text-sm text-slate-500">
                {orders.length} pending batch{orders.length === 1 ? "" : "es"}
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {orders.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No batches are waiting for verification.
                </p>
              ) : (
                orders.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setSelectedId(entry.id)}
                    className={`w-full rounded-lg border p-3 text-left ${selectedId === entry.id ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                  >
                    <p className="font-semibold">{entry.orderNo}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {entry.recipeCode} · {entry.targetQty} units
                    </p>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          {!order ? (
            <Card>
              <CardContent className="flex min-h-96 flex-col items-center justify-center text-center">
                <ShieldCheck className="text-slate-400" size={42} />
                <h2 className="mt-4 text-xl font-semibold">
                  Select a batch to begin
                </h2>
                <p className="mt-2 text-slate-500">
                  The sewing queue stays locked until this terminal approves a
                  batch.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <Card>
                <CardContent className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-indigo-100 text-indigo-800">
                        PENDING QC
                      </Badge>
                      <span className="text-sm text-slate-500">
                        {order.recipeCode}
                      </span>
                    </div>
                    <h2 className="mt-3 text-2xl font-bold">{order.orderNo}</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {order.targetQty} garments · Roll {order.fabricRollId}
                    </p>
                  </div>
                  <Button
                    className="gap-2 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    onClick={() => void openHistory()}
                  >
                    <History size={16} />
                    History
                  </Button>
                </CardContent>
              </Card>

              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-800"
                >
                  {error}
                </div>
              )}

              <Card>
                <CardHeader>
                  <h2 className="font-semibold">Component count matrix</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Counts autosave as you enter them.
                  </p>
                </CardHeader>
                <CardContent className="overflow-x-auto p-0">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Component</th>
                        <th className="px-5 py-3">Expected</th>
                        <th className="px-5 py-3">Actual</th>
                        <th className="px-5 py-3">Variance</th>
                        <th className="px-5 py-3">State</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {order.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-5 py-4 font-medium">
                            {item.componentName}
                          </td>
                          <td className="px-5 py-4 tabular-nums">
                            {item.expectedQty}
                          </td>
                          <td className="px-5 py-4">
                            <Input
                              aria-label={`Actual count for ${item.componentName}`}
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={item.actualQty ?? ""}
                              onChange={(event) =>
                                updateCount(item, event.target.value)
                              }
                              className="w-28"
                            />
                          </td>
                          <td className="px-5 py-4 tabular-nums text-slate-600">
                            {item.actualQty === null
                              ? "—"
                              : item.actualQty - item.expectedQty}
                          </td>
                          <td className="px-5 py-4">
                            <Badge className={statusStyle(item.status)}>
                              {item.status ?? "UNCOUNTED"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <div className="grid gap-6 md:grid-cols-[1fr_280px]">
                <Card>
                  <CardHeader>
                    <h2 className="font-semibold">Fabric usage</h2>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-sm text-slate-500">Actual fabric</p>
                        <p className="mt-1 text-2xl font-bold">
                          {order.actualFabricYds.toFixed(2)} yd
                        </p>
                      </div>
                      <p className="text-sm text-slate-600">
                        Wastage is recorded with the decision.
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card
                  className={
                    blockers.length ? "border-amber-300" : "border-emerald-300"
                  }
                >
                  <CardContent>
                    <div className="flex items-center gap-3">
                      {blockers.length ? (
                        <LockKeyhole className="text-amber-700" />
                      ) : (
                        <CheckCircle2 className="text-emerald-700" />
                      )}
                      <div>
                        <p className="font-semibold">
                          {blockers.length
                            ? "Approval locked"
                            : "Gate unlocked"}
                        </p>
                        <p className="text-sm text-slate-600">
                          {blockers.length
                            ? `${blockers.length} blocker${blockers.length === 1 ? "" : "s"}`
                            : "All components verified"}
                        </p>
                      </div>
                    </div>
                    {blockers.length > 0 && (
                      <ul className="mt-4 space-y-1 text-sm text-amber-900">
                        {blockers.map((blocker) => (
                          <li key={blocker}>• {blocker}</li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="flex flex-wrap justify-end gap-3">
                  <Button
                    className="border border-red-300 bg-white text-red-700 hover:bg-red-50"
                    onClick={() => setShowReject(true)}
                  >
                    <AlertTriangle size={16} className="mr-2" />
                    Reject batch
                  </Button>
                  <Button
                    disabled={blockers.length > 0}
                    className="bg-indigo-700 text-white hover:bg-indigo-800"
                    onClick={() => void approve()}
                  >
                    <ShieldCheck size={16} className="mr-2" />
                    Approve batch
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {showReject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-title"
        >
          <Card className="w-full max-w-lg">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <h2 id="reject-title" className="text-lg font-semibold">
                  Reject batch
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  The reason is saved in the immutable verification history.
                </p>
              </div>
              <Button
                aria-label="Close rejection dialog"
                className="px-2 text-slate-500 hover:bg-slate-100"
                onClick={() => setShowReject(false)}
              >
                <X size={18} />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <label htmlFor="rejection-note" className="text-sm font-medium">
                Reason note
              </label>
              <Textarea
                id="rejection-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Describe the shortage or quality issue..."
                aria-describedby="rejection-help"
              />
              <p id="rejection-help" className="text-xs text-slate-500">
                Minimum 10 characters. Current: {note.trim().length}
              </p>
              <div className="flex justify-end gap-3">
                <Button
                  className="border border-slate-300 bg-white text-slate-700"
                  onClick={() => setShowReject(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-red-700 text-white hover:bg-red-800"
                  onClick={() => void reject()}
                >
                  Confirm rejection
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {showHistory && history && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/30"
          role="dialog"
          aria-modal="true"
          aria-labelledby="history-title"
        >
          <aside className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 id="history-title" className="text-xl font-bold">
                Verification history
              </h2>
              <Button
                aria-label="Close history"
                className="px-2 text-slate-500 hover:bg-slate-100"
                onClick={() => setShowHistory(false)}
              >
                <X size={18} />
              </Button>
            </div>
            <div className="mt-6 space-y-4">
              {history.logs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex items-center justify-between">
                    <Badge
                      className={
                        log.decision === "APPROVED"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                      }
                    >
                      {log.decision}
                    </Badge>
                    <time className="text-xs text-slate-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </time>
                  </div>
                  <p className="mt-3 text-sm text-slate-700">
                    By {log.verifier.fullName}
                  </p>
                  {log.rejectionNote && (
                    <p className="mt-2 text-sm text-slate-600">
                      {log.rejectionNote}
                    </p>
                  )}
                </div>
              ))}
              {history.events.map((event) => (
                <div
                  key={event.id}
                  className="border-l-2 border-indigo-200 pl-4 text-sm"
                >
                  <p className="font-medium">
                    {event.fromStatus ?? "Created"} → {event.toStatus}
                  </p>
                  <time className="text-xs text-slate-500">
                    {new Date(event.at).toLocaleString()}
                  </time>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}

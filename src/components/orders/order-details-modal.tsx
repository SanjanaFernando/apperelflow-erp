"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  Package,
  Scissors,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type OrderSummaryInfo = {
  id: string;
  orderNo: string;
  recipeCode: string;
  targetQty: number;
  status: string;
  fabricRollId?: string;
  actualFabricYds?: number;
};

export type FullOrderDetails = {
  id: string;
  orderNo: string;
  recipeCode: string;
  targetQty: number;
  fabricRollId: string;
  actualFabricYds: number;
  status: string;
  submittedAt: string | null;
  rejectionCount: number;
  items: Array<{
    id: string;
    componentName: string;
    expectedQty: number;
    actualQty: number | null;
    status: "GREEN" | "YELLOW" | "RED" | null;
  }>;
  events: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    actorId: string;
  }>;
};

const statusStyles: Record<string, string> = {
  CUTTING_IN_PROGRESS: "bg-slate-100 text-slate-700 border-slate-200",
  PENDING_VERIFICATION: "bg-amber-100 text-amber-900 border-amber-200",
  VERIFIED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REJECTED: "bg-red-100 text-red-800 border-red-200",
  SEWING_IN_PROGRESS: "bg-indigo-100 text-indigo-800 border-indigo-200",
};

export function OrderDetailsModal({
  order,
  isOpen,
  onClose,
}: {
  order: OrderSummaryInfo | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [details, setDetails] = useState<FullOrderDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !order?.id) {
      setDetails(null);
      setError("");
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError("");

    fetch(`/api/orders/${order.id}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Unable to load full order details.");
        }
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setDetails(data.order);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message ?? "Failed to load details");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, order?.id]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !order) return null;

  const currentStatus = details?.status ?? order.status;
  const targetQty = details?.targetQty ?? order.targetQty;
  const recipeCode = details?.recipeCode ?? order.recipeCode;
  const fabricRollId = details?.fabricRollId ?? order.fabricRollId ?? "—";
  const actualFabricYds =
    details?.actualFabricYds ?? order.actualFabricYds ?? 0;
  const rejectionCount = details?.rejectionCount ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-details-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative my-8 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50/80 p-5 sm:p-6">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                <Scissors size={15} />
              </span>
              <h2
                id="order-details-title"
                className="text-xl font-bold tracking-tight text-slate-900"
              >
                {order.orderNo}
              </h2>
              <Badge
                className={`border text-xs font-semibold ${
                  statusStyles[currentStatus] ?? "bg-slate-100 text-slate-700"
                }`}
              >
                {currentStatus.replaceAll("_", " ")}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 sm:text-sm">
              Recipe: <span className="font-semibold text-slate-700">{recipeCode}</span> · Target:{" "}
              <span className="font-semibold text-slate-700">{targetQty} garments</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="max-h-[70vh] space-y-6 overflow-y-auto p-5 sm:p-6">
          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <span className="text-xs font-medium text-slate-500">Target Qty</span>
              <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">
                {targetQty}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <span className="text-xs font-medium text-slate-500">Fabric Roll</span>
              <p className="mt-1 truncate text-lg font-bold text-slate-900">
                {fabricRollId}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <span className="text-xs font-medium text-slate-500">Actual Fabric</span>
              <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">
                {actualFabricYds ? `${actualFabricYds} yd` : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <span className="text-xs font-medium text-slate-500">Rejections</span>
              <p
                className={`mt-1 text-lg font-bold tabular-nums ${
                  rejectionCount > 0 ? "text-red-700" : "text-slate-900"
                }`}
              >
                {rejectionCount}
              </p>
            </div>
          </div>

          {/* Components Multiplier Breakdown */}
          <div>
            <div className="mb-2.5 flex items-center gap-2">
              <Layers size={16} className="text-indigo-600" />
              <h3 className="font-semibold text-slate-900">
                Component Multiplier Pieces
              </h3>
            </div>

            {loading ? (
              <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-8 text-sm text-slate-500">
                <span className="animate-pulse">Loading component counts...</span>
              </div>
            ) : details?.items && details.items.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Component</th>
                      <th className="px-4 py-2.5 font-medium text-center">
                        Expected
                      </th>
                      <th className="px-4 py-2.5 font-medium text-center">
                        Counted
                      </th>
                      <th className="px-4 py-2.5 font-medium text-right">
                        QC Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {details.items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-2.5 font-medium text-slate-800">
                          {item.componentName}
                        </td>
                        <td className="px-4 py-2.5 text-center tabular-nums text-slate-600">
                          {item.expectedQty}
                        </td>
                        <td className="px-4 py-2.5 text-center tabular-nums font-semibold text-slate-900">
                          {item.actualQty ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {item.status === "GREEN" && (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                              Matched
                            </span>
                          )}
                          {item.status === "YELLOW" && (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                              Overage
                            </span>
                          )}
                          {item.status === "RED" && (
                            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                              Shortage
                            </span>
                          )}
                          {!item.status && (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                              Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500">
                {error ? error : "Component details ready when order is loaded."}
              </div>
            )}
          </div>

          {/* Workflow Timeline Events */}
          {details?.events && details.events.length > 0 && (
            <div>
              <div className="mb-2.5 flex items-center gap-2">
                <Clock size={16} className="text-indigo-600" />
                <h3 className="font-semibold text-slate-900">Workflow Transitions</h3>
              </div>
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                {details.events.map((evt, idx) => (
                  <div
                    key={evt.id ?? idx}
                    className="flex items-center gap-2 text-xs sm:text-sm text-slate-600"
                  >
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <span>
                      <strong className="font-medium text-slate-800">
                        {evt.fromStatus ? evt.fromStatus.replaceAll("_", " ") : "Draft"}
                      </strong>{" "}
                      →{" "}
                      <strong className="font-medium text-slate-900">
                        {evt.toStatus.replaceAll("_", " ")}
                      </strong>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end border-t border-slate-100 bg-slate-50/80 px-6 py-4">
          <Button
            type="button"
            className="border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

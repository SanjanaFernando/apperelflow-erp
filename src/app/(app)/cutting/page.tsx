"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ClipboardPlus,
  Factory,
  RefreshCw,
  Send,
  Scissors,
  Search,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { BackButton } from "@/components/ui/back-button";
import { Pagination } from "@/components/ui/pagination";
import { orderFormSchema } from "@/lib/validators";

type Recipe = {
  id: string;
  recipeCode: string;
  name: string;
  category: string;
  stdFabricYards: number;
  wastageCap: number;
  components: Array<{
    id: string;
    componentName: string;
    piecesPerGarment: number;
  }>;
};

type Order = {
  id: string;
  orderNo: string;
  recipeCode: string;
  targetQty: number;
  status: string;
  fabricRollId: string;
};

const statusStyles: Record<string, string> = {
  CUTTING_IN_PROGRESS: "bg-slate-100 text-slate-700",
  PENDING_VERIFICATION: "bg-amber-100 text-amber-900",
  VERIFIED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
  SEWING_IN_PROGRESS: "bg-indigo-100 text-indigo-800",
};

export default function CuttingPage() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [recipeId, setRecipeId] = useState("");
  const [targetQty, setTargetQty] = useState(50);
  const [fabricRollId, setFabricRollId] = useState("");
  const [actualFabricYds, setActualFabricYds] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionOrderId, setActionOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  async function loadData() {
    const [recipeResponse, orderResponse] = await Promise.all([
      fetch("/api/recipes"),
      fetch("/api/orders"),
    ]);
    if (orderResponse.status === 401 || recipeResponse.status === 401) {
      router.push("/login");
      return;
    }
    if (orderResponse.status === 403) {
      setMessage("Not permitted for your role.");
      setLoading(false);
      return;
    }
    const recipeData = await recipeResponse.json();
    const orderData = await orderResponse.json();
    setRecipes(recipeData.recipes ?? []);
    setOrders(orderData.orders ?? []);
    setRecipeId((current) => current || recipeData.recipes?.[0]?.id || "");
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  const recipe = recipes.find((entry) => entry.id === recipeId);
  const preview = useMemo(
    () =>
      recipe?.components.map((component) => ({
        ...component,
        expected: targetQty * component.piecesPerGarment,
      })) ?? [],
    [recipe, targetQty],
  );
  const filteredOrders = orders.filter((order) => {
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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredOrders.slice(startIndex, startIndex + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  async function createOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldError("");
    setMessage("");
    const parsed = orderFormSchema.safeParse({
      recipeId,
      targetQty,
      fabricRollId,
      actualFabricYds,
    });
    if (!parsed.success) {
      setFieldError(
        parsed.error.issues[0]?.message ?? "Check the order fields.",
      );
      return;
    }
    setSaving(true);
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setFieldError(data.error?.message ?? "Unable to create order.");
      return;
    }
    setFabricRollId("");
    setActualFabricYds("");
    setMessage(`${data.order.orderNo} created in cutting.`);
    await loadData();
  }

  async function transition(order: Order, action: "submit" | "recut") {
    setActionOrderId(order.id);
    setMessage("");
    try {
      const response = await fetch(`/api/orders/${order.id}/${action}`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error?.message ?? "Unable to update the order.");
        return;
      }
      setMessage(`${order.orderNo} updated successfully.`);
      await loadData();
    } catch {
      setMessage("Network error while updating the order.");
    } finally {
      setActionOrderId(null);
    }
  }

  if (loading) return <LoadingState label="Loading cutting floor" />;
  if (message === "Not permitted for your role.")
    return (
      <main className="min-h-screen bg-slate-100 p-8 text-slate-900">
        <Card>
          <CardContent>
            <h1 className="text-xl font-bold">Not permitted for your role</h1>
            <p className="mt-2 text-slate-600">
              Only cutting supervisors can access order creation.
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
              <div className="text-white">
                <div className="flex items-center gap-2 text-indigo-200">
                  <Scissors size={18} />
                  <p className="text-sm font-semibold uppercase tracking-[0.18em]">
                    GateLine / Cutting floor
                  </p>
                </div>
                <h1 className="mt-2 text-3xl font-bold tracking-tight">
                  Production orders
                </h1>
                <p className="mt-1 text-indigo-100">
                  Create a batch, verify the multiplier, then release it to QC.
                </p>
              </div>
            </div>
            <Button
              className="gap-2 border border-white/20 bg-white text-slate-800 hover:bg-indigo-50"
              onClick={() => void loadData()}
            >
              <RefreshCw size={16} />
              Refresh orders
            </Button>
          </div>
        </header>
        {message && (
          <div
            role="status"
            className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm font-medium text-indigo-900"
          >
            {message}
          </div>
        )}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Factory size={18} className="text-indigo-700" />
                <h2 className="font-semibold">Order register</h2>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Only your cutting orders are visible here.
              </p>
              <div className="relative mt-4 max-w-md">
                <Search
                  className="pointer-events-none absolute left-3 top-2.5 text-slate-400"
                  size={17}
                />
                <Input
                  aria-label="Search cutting orders"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search order, recipe, roll, status..."
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-155 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Order</th>
                    <th className="px-5 py-3">Recipe</th>
                    <th className="px-5 py-3">Quantity</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-12 text-center text-slate-500"
                      >
                        No cutting orders yet.
                      </td>
                    </tr>
                  ) : (
                    paginatedOrders.map((order) => (
                      <tr key={order.id}>
                        <td className="px-5 py-4 font-semibold">
                          {order.orderNo}
                          <p className="text-xs font-normal text-slate-500">
                            {order.fabricRollId}
                          </p>
                        </td>
                        <td className="px-5 py-4">{order.recipeCode}</td>
                        <td className="px-5 py-4 tabular-nums">
                          {order.targetQty}
                        </td>
                        <td className="px-5 py-4">
                          <Badge
                            className={
                              statusStyles[order.status] ??
                              "bg-slate-100 text-slate-700"
                            }
                          >
                            {order.status.replaceAll("_", " ")}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {order.status === "CUTTING_IN_PROGRESS" && (
                            <Button
                              disabled={actionOrderId === order.id}
                              className="gap-1 border border-indigo-200 bg-indigo-50 px-3 text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
                              onClick={() => void transition(order, "submit")}
                            >
                              <Send size={14} />
                              {actionOrderId === order.id
                                ? "Submitting..."
                                : "Submit"}
                            </Button>
                          )}
                          {order.status === "REJECTED" && (
                            <Button
                              disabled={actionOrderId === order.id}
                              className="border border-red-200 bg-red-50 px-3 text-red-800 hover:bg-red-100 disabled:opacity-50"
                              onClick={() => void transition(order, "recut")}
                            >
                              {actionOrderId === order.id
                                ? "Re-cutting..."
                                : "Re-cut"}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {filteredOrders.length > 0 && (
                <div className="border-t border-slate-200 px-5 py-3">
                  <Pagination
                    currentPage={currentPage}
                    totalItems={filteredOrders.length}
                    pageSize={pageSize}
                    pageSizeOptions={[10, 20, 50]}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={(size) => {
                      setPageSize(size);
                      setCurrentPage(1);
                    }}
                    itemLabel="orders"
                  />
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ClipboardPlus size={18} className="text-indigo-700" />
                <h2 className="font-semibold">New cutting order</h2>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                The server ignores client status overrides.
              </p>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={createOrder}>
                <div>
                  <label htmlFor="recipe" className="text-sm font-medium">
                    Recipe
                  </label>
                  <select
                    id="recipe"
                    value={recipeId}
                    onChange={(event) => setRecipeId(event.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-400 bg-white px-3 text-sm"
                  >
                    <option value="">Select a recipe</option>
                    {recipes.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.recipeCode} · {entry.name} · cap{" "}
                        {entry.wastageCap}%
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="target" className="text-sm font-medium">
                    Target garments
                  </label>
                  <Input
                    id="target"
                    type="number"
                    min={1}
                    step={1}
                    value={targetQty}
                    onChange={(event) =>
                      setTargetQty(Number(event.target.value))
                    }
                    onKeyDown={(event) =>
                      ["-", ".", ",", "e", "E", "+"].includes(event.key) &&
                      event.preventDefault()
                    }
                  />
                </div>
                <div>
                  <label htmlFor="roll" className="text-sm font-medium">
                    Fabric roll ID
                  </label>
                  <Input
                    id="roll"
                    value={fabricRollId}
                    onChange={(event) => setFabricRollId(event.target.value)}
                    placeholder="ROLL-001"
                    aria-invalid={Boolean(fieldError)}
                  />
                </div>
                <div>
                  <label htmlFor="yards" className="text-sm font-medium">
                    Actual fabric used (yds)
                  </label>
                  <Input
                    id="yards"
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={actualFabricYds}
                    onChange={(event) => setActualFabricYds(event.target.value)}
                    placeholder="90.00"
                    aria-invalid={Boolean(fieldError)}
                  />
                </div>
                {fieldError && (
                  <p
                    className="rounded-md bg-red-50 p-2 text-sm font-medium text-red-700"
                    role="alert"
                  >
                    {fieldError}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-indigo-700 text-white hover:bg-indigo-800"
                >
                  <Sparkles size={16} className="mr-2" />
                  {saving ? "Creating..." : "Create cutting order"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
        {recipe && (
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Live multiplier preview</h2>
              <p className="mt-1 text-sm text-slate-500">
                {targetQty} garments × component multiplier
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {preview.map((component) => (
                  <div
                    key={component.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                  >
                    <p className="text-sm font-medium">
                      {component.componentName}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {targetQty} × {component.piecesPerGarment}
                    </p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-slate-950">
                      {component.expected}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-6 border-t border-slate-200 pt-4 text-sm">
                <p>
                  <span className="text-slate-500">Expected fabric:</span>{" "}
                  <strong>
                    {(targetQty * recipe.stdFabricYards).toFixed(2)} yd
                  </strong>
                </p>
                <p>
                  <span className="text-slate-500">Wastage cap:</span>{" "}
                  <strong>{recipe.wastageCap}%</strong>
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

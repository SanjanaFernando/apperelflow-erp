import { LoaderCircle } from "lucide-react";

export function LoadingState({
  label = "Loading workspace",
}: {
  label?: string;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-slate-100 px-6 text-slate-700">
      <div className="flex w-full max-w-sm flex-col items-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
          <LoaderCircle className="animate-spin" size={24} aria-hidden="true" />
        </div>
        <p className="mt-4 text-sm font-semibold text-slate-900">{label}</p>
        <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-1/2 animate-loading-bar rounded-full bg-indigo-600" />
        </div>
      </div>
    </div>
  );
}

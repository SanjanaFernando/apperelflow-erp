"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function BackButton() {
  const router = useRouter();

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/dashboard");
  }

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Go back"
      title="Go back"
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
    >
      <ArrowLeft size={18} aria-hidden="true" />
    </button>
  );
}

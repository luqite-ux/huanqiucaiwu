"use client";

import { useState } from "react";

export function ExportReimbursementsButton(props: {
  statusFilter?: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onExport() {
    setError(null);
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (props.statusFilter) sp.set("status", props.statusFilter);
      const res = await fetch(
        `/api/reimbursements/export${sp.toString() ? `?${sp}` : ""}`,
        { method: "GET", credentials: "include" }
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `导出失败 (${res.status})`);
      }
      const blob = await res.blob();
      const dispo = res.headers.get("Content-Disposition");
      let name = `reimbursements-${new Date().toISOString().slice(0, 10)}.xlsx`;
      const m = dispo?.match(/filename="([^"]+)"/);
      if (m?.[1]) name = m[1];
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "导出失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={loading}
        onClick={() => void onExport()}
        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60"
      >
        {loading ? "正在生成…" : props.label ?? "导出 Excel"}
      </button>
      {error ? (
        <p className="text-xs text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

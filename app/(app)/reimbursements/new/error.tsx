"use client";

export default function NewReimbursementError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const dev = process.env.NODE_ENV === "development";

  return (
    <div className="mx-auto max-w-3xl rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900">
      <p className="font-semibold">提交报销页加载失败</p>
      <p className="mt-2 whitespace-pre-wrap break-words">
        {dev
          ? error.message
          : `请刷新或稍后再试。若反复出现，请联系管理员并提供错误编号：${error.digest ?? "—"}`}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
      >
        重试
      </button>
    </div>
  );
}

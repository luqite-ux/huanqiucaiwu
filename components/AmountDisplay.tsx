import type { CurrencyCode } from "@/types/database";

type RowLike = {
  currency?: string | null;
  original_amount?: string | number | null;
  amount?: string | number | null;
  amount_cny?: string | number | null;
  exchange_rate?: string | number | null;
  exchange_rate_date?: string | null;
};

function n(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

/** 列表等紧凑展示：优先强调折合 CN¥ */
export function AmountDisplayInline({ row }: { row: RowLike }) {
  const ccy = (row.currency ?? "CNY") as CurrencyCode;
  const orig = n(row.original_amount ?? row.amount);
  const cny = n(row.amount_cny ?? row.amount);
  const rate = n(row.exchange_rate ?? 1);
  const d = row.exchange_rate_date;

  if (ccy === "CNY") {
    return (
      <div className="tabular-nums">
        <span className="font-medium text-slate-900">
          ¥{cny.toFixed(2)}
        </span>
        <span className="ml-1 text-xs text-slate-500">CNY</span>
      </div>
    );
  }

  return (
    <div className="max-w-[14rem] text-xs tabular-nums leading-relaxed text-slate-800">
      <div>
        {orig.toFixed(2)} USD
        <span className="text-slate-500">
          {" "}
          · 汇率 {rate.toFixed(4)}
          {d ? ` (${d})` : ""}
        </span>
      </div>
      <div className="font-semibold text-slate-900">折合 ¥{cny.toFixed(2)}</div>
    </div>
  );
}

/** 详情页完整展示 */
export function AmountDisplayBlock({ row }: { row: RowLike }) {
  const ccy = (row.currency ?? "CNY") as CurrencyCode;
  const orig = n(row.original_amount ?? row.amount);
  const cny = n(row.amount_cny ?? row.amount);
  const rate = n(row.exchange_rate ?? 1);
  const d = row.exchange_rate_date;

  if (ccy === "CNY") {
    return (
      <div className="space-y-1">
        <div className="text-lg font-semibold tabular-nums text-slate-900">
          ¥{cny.toFixed(2)}
        </div>
        <div className="text-xs text-slate-500">币种 CNY（财务汇总口径）</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm text-slate-700">
        原始金额{" "}
        <span className="font-medium tabular-nums">{orig.toFixed(2)} USD</span>
      </div>
      <div className="text-xs text-slate-500">
        汇率：{" "}
        <span className="font-mono tabular-nums">{rate.toFixed(6)}</span>
        {d ? `（${d}）` : null}{" "}
        <span className="text-slate-400">
          · 按当日参考汇率折算，必要时可手动调整
        </span>
      </div>
      <div className="text-lg font-semibold tabular-nums text-slate-900">
        折合 ¥{cny.toFixed(2)}{" "}
        <span className="text-xs font-normal text-slate-500">
          （财务汇总口径）
        </span>
      </div>
    </div>
  );
}

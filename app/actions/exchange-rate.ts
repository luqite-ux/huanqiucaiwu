"use server";

import { fetchUsdToCnyRate } from "@/lib/exchange-rate";

export async function getUsdToCnyRateAction(): Promise<
  | { ok: true; rate: number; date: string; source: "frankfurter" }
  | { ok: false; error: string }
> {
  try {
    const r = await fetchUsdToCnyRate();
    return { ok: true, rate: r.rate, date: r.date, source: r.source };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "获取汇率失败",
    };
  }
}

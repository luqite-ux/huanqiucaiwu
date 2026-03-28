/**
 * 服务端获取 USD→CNY 参考汇率（Frankfurter，无需 API Key）
 * https://www.frankfurter.app/docs/
 */
export type ExchangeRateFetchResult = {
  rate: number;
  date: string;
  source: "frankfurter";
};

export async function fetchUsdToCnyRate(): Promise<ExchangeRateFetchResult> {
  const url = "https://api.frankfurter.app/latest?from=USD&to=CNY";
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new Error(`汇率接口返回 ${res.status}`);
  }
  const data = (await res.json()) as {
    date?: string;
    rates?: { CNY?: number };
  };
  const rate = data.rates?.CNY;
  const date = data.date;
  if (typeof rate !== "number" || !Number.isFinite(rate) || !date) {
    throw new Error("汇率数据无效");
  }
  return { rate, date, source: "frankfurter" };
}

// Deterministic hourly ambulance arrival forecast + inbound acuity mix,
// ported 1:1 from the original AmbulanceForecast.tsx model.

const CURVE = [
  0.4, 0.3, 0.25, 0.2, 0.25, 0.4, 0.6, 0.85, 1.0, 1.05, 1.1, 1.15, 1.2, 1.2,
  1.15, 1.2, 1.3, 1.35, 1.3, 1.2, 1.05, 0.9, 0.75, 0.55,
];
const BASE_RATE = 3.2; // avg arrivals/hr at curve weight 1.0

export function buildHourlyForecast(currentInbound, hours = 6) {
  const now = new Date();
  const inboundBoost = Math.min(1.5, currentInbound * 0.12);

  return Array.from({ length: hours }, (_, i) => {
    const d = new Date(now.getTime() + i * 3_600_000);
    const h = d.getHours();
    const expected = BASE_RATE * CURVE[h] + (i === 0 ? inboundBoost : 0);
    const ci = Math.sqrt(expected) * 1.28; // ~80% CI, Poisson-ish
    return {
      label: d.toLocaleTimeString("en-US", { hour: "numeric" }),
      hour: h,
      expected: Number(expected.toFixed(2)),
      low: Number(Math.max(0, expected - ci).toFixed(2)),
      high: Number((expected + ci).toFixed(2)),
    };
  });
}

export function acuityMixForecast(ambulances) {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  ambulances.forEach((a) => {
    if (a.status === "en_route") counts[a.acuity]++;
  });
  const total = Object.values(counts).reduce((s, n) => s + n, 0) || 1;
  return [1, 2, 3, 4, 5].map((k) => ({
    acuity: k,
    count: counts[k],
    pct: Number(((counts[k] / total) * 100).toFixed(1)),
  }));
}

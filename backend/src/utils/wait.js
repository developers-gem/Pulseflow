const BASE_WAIT = { 1: 0, 2: 8, 3: 25, 4: 55, 5: 90 };

export function predictWait(acuity, queueAhead = 0, censusLoad = 0.6) {
  const base = BASE_WAIT[acuity] ?? 30;
  return Math.max(0, Math.round(base + queueAhead * 7 + censusLoad * 20));
}

import { codeInfo, GROUP_ORDER, type WeatherGroup } from "../shared/wmo.ts";

export interface WeightedValue {
  value: number | null | undefined;
  weight: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function available(points: WeightedValue[]): { value: number; weight: number }[] {
  return points
    .filter(
      (point): point is { value: number; weight: number } =>
        point.value != null && Number.isFinite(point.value) && point.weight > 0,
    )
    .map((point) => ({ value: point.value, weight: point.weight }));
}

export function weightedMean(points: WeightedValue[], trim = false): number | null {
  const values = available(points);
  if (!values.length) return null;
  const total = values.reduce((sum, point) => sum + point.weight, 0);
  const mean = values.reduce((sum, point) => sum + point.value * point.weight, 0) / total;

  if (!trim || values.length < 4) return mean;

  const variance =
    values.reduce((sum, point) => sum + point.weight * (point.value - mean) ** 2, 0) / total;
  const sigma = Math.sqrt(variance);
  if (sigma < 0.05) return mean;

  const filtered = values.filter((point) => Math.abs(point.value - mean) <= sigma * 2.4 + 0.15);
  const filteredWeight = filtered.reduce((sum, point) => sum + point.weight, 0);
  if (filtered.length < 3 || filteredWeight < total * 0.55) return mean;

  return (
    filtered.reduce((sum, point) => sum + point.value * point.weight, 0) / filteredWeight
  );
}

export function weightedStd(points: WeightedValue[]): number | null {
  const values = available(points);
  if (values.length < 2) return values.length ? 0 : null;
  const total = values.reduce((sum, point) => sum + point.weight, 0);
  const mean = values.reduce((sum, point) => sum + point.value * point.weight, 0) / total;
  const variance =
    values.reduce((sum, point) => sum + point.weight * (point.value - mean) ** 2, 0) / total;
  return Math.sqrt(Math.max(0, variance));
}

export function weightedMedian(points: WeightedValue[]): number | null {
  const values = available(points).sort((a, b) => a.value - b.value);
  if (!values.length) return null;
  const total = values.reduce((sum, point) => sum + point.weight, 0);
  let running = 0;
  for (const point of values) {
    running += point.weight;
    if (running >= total / 2) return point.value;
  }
  return values[values.length - 1].value;
}

export function weightedModeCode(points: WeightedValue[]): number | null {
  const values = available(points);
  if (!values.length) return null;

  const groupWeights = new Map<WeatherGroup, number>();
  const codeWeights = new Map<number, number>();

  for (const point of values) {
    const info = codeInfo(Math.round(point.value));
    groupWeights.set(info.group, (groupWeights.get(info.group) ?? 0) + point.weight);
    codeWeights.set(
      Math.round(point.value),
      (codeWeights.get(Math.round(point.value)) ?? 0) + point.weight,
    );
  }

  let winningGroup: WeatherGroup = "cloudy";
  let winningWeight = -1;
  for (const group of GROUP_ORDER) {
    const weight = groupWeights.get(group) ?? 0;
    if (
      weight > winningWeight + 0.0001 ||
      (Math.abs(weight - winningWeight) <= 0.0001 &&
        groupWeights.has(group) &&
        severityOf(group) > severityOf(winningGroup))
    ) {
      winningGroup = group;
      winningWeight = weight;
    }
  }

  let winningCode: number | null = null;
  let winningCodeWeight = -1;
  for (const [code, weight] of codeWeights) {
    if (codeInfo(code).group !== winningGroup) continue;
    if (weight > winningCodeWeight) {
      winningCode = code;
      winningCodeWeight = weight;
    }
  }

  return winningCode;
}

function severityOf(group: WeatherGroup): number {
  const sample: Record<WeatherGroup, number> = {
    clear: 0,
    partly: 1,
    cloudy: 2,
    fog: 3,
    drizzle: 4,
    rain: 5,
    snow: 6,
    thunder: 7,
  };
  return sample[group];
}

export function circularMean(points: WeightedValue[]): number | null {
  const values = available(points);
  if (!values.length) return null;
  let x = 0;
  let y = 0;
  for (const point of values) {
    const radians = (point.value * Math.PI) / 180;
    x += Math.cos(radians) * point.weight;
    y += Math.sin(radians) * point.weight;
  }
  if (Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9) return null;
  const degrees = (Math.atan2(y, x) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

export function temperatureAgreement(spread: number | null, sourceCount: number): number {
  if (spread == null) return 60;
  const coveragePenalty = sourceCount >= 6 ? 0 : (6 - sourceCount) * 3;
  return Math.round(clamp(99 - spread * 15 - coveragePenalty, 35, 99));
}

export function hourConfidence(
  tempSpread: number | null,
  precipPairs: { precipitation: number | null; probability: number | null }[],
  sourceCount: number,
): number {
  const tempScore = temperatureAgreement(tempSpread, sourceCount);
  const wet = precipPairs.filter((pair) => (pair.precipitation ?? 0) >= 0.12);
  const wetFraction = wet.length / Math.max(1, precipPairs.length);
  const disagreement = Math.min(wetFraction, 1 - wetFraction);
  const precipScore = clamp(100 - disagreement * 150, 20, 100);
  const probabilitySpread = standardDeviation(
    precipPairs.map((pair) => pair.probability).filter((value): value is number => value != null),
  );
  const probabilityScore = clamp(100 - (probabilitySpread ?? 0) * 1.1, 25, 100);
  return Math.round(clamp(tempScore * 0.7 + precipScore * 0.16 + probabilityScore * 0.14, 20, 99));
}

export function standardDeviation(values: number[]): number | null {
  if (values.length < 2) return values.length ? 0 : null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

export function mostCommonBoolean(
  points: { value: boolean | null | undefined; weight: number }[],
): boolean {
  const trueWeight = points.reduce(
    (sum, point) => (point.value ? sum + point.weight : sum),
    0,
  );
  const falseWeight = points.reduce(
    (sum, point) => (point.value === false ? sum + point.weight : sum),
    0,
  );
  return trueWeight >= falseWeight;
}

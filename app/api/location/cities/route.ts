import { NextResponse } from "next/server";
import { cityZones } from "@/lib/platformCatalog";

type CountriesNowCitiesResponse = {
  error?: boolean;
  msg?: string;
  data?: string[];
};

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const FALLBACK_CITIES = cityZones.map((entry) => entry.city);

let cachedCities: string[] | null = null;
let cachedAt = 0;

function normalizeCities(cities: string[]) {
  const seen = new Set<string>();

  for (const city of cities) {
    const normalized = city.trim().replace(/\s+/g, " ");
    if (!normalized) continue;
    seen.add(normalized);
  }

  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

async function fetchIndiaCitiesFromProvider() {
  const response = await fetch("https://countriesnow.space/api/v0.1/countries/cities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ country: "India" }),
    cache: "no-store",
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as CountriesNowCitiesResponse;
  if (payload.error || !Array.isArray(payload.data)) return null;

  return normalizeCities([...payload.data, ...FALLBACK_CITIES]);
}

export async function GET() {
  const now = Date.now();

  if (cachedCities && now - cachedAt < CACHE_TTL_MS) {
    return NextResponse.json({ cities: cachedCities, source: "cache" });
  }

  try {
    const providerCities = await fetchIndiaCitiesFromProvider();
    if (providerCities && providerCities.length > 0) {
      cachedCities = providerCities;
      cachedAt = now;
      return NextResponse.json({ cities: providerCities, source: "provider" });
    }
  } catch {
    // Fallback below keeps onboarding available even if provider is down.
  }

  const fallback = normalizeCities(FALLBACK_CITIES);
  cachedCities = fallback;
  cachedAt = now;

  return NextResponse.json({ cities: fallback, source: "fallback" });
}

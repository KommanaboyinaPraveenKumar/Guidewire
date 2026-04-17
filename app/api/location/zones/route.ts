import { NextRequest, NextResponse } from "next/server";
import { cityZones } from "@/lib/platformCatalog";

type PostalApiPostOffice = {
  Name?: string;
};

type PostalApiResponseItem = {
  Status?: string;
  PostOffice?: PostalApiPostOffice[] | null;
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const zoneCache = new Map<string, { zones: string[]; cachedAt: number }>();

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function dedupeAndSort(values: string[]) {
  const unique = new Set<string>();

  for (const value of values) {
    const normalized = normalize(value);
    if (!normalized) continue;
    unique.add(normalized);
  }

  return Array.from(unique).sort((a, b) => a.localeCompare(b));
}

function getCatalogZones(city: string) {
  return cityZones.find((entry) => entry.city.toLowerCase() === city.toLowerCase())?.zones ?? [];
}

async function fetchZonesFromPostalApi(city: string) {
  const url = `https://api.postalpincode.in/postoffice/${encodeURIComponent(city)}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;

  const payload = (await response.json()) as PostalApiResponseItem[];
  const first = Array.isArray(payload) ? payload[0] : undefined;
  if (!first || first.Status !== "Success" || !Array.isArray(first.PostOffice)) return null;

  const names = first.PostOffice
    .map((office) => (typeof office.Name === "string" ? office.Name : ""))
    .filter(Boolean);

  return dedupeAndSort(names);
}

export async function GET(req: NextRequest) {
  const city = normalize(req.nextUrl.searchParams.get("city") ?? "");
  if (!city) {
    return NextResponse.json({ error: "city is required" }, { status: 400 });
  }

  const cacheKey = city.toLowerCase();
  const now = Date.now();
  const cached = zoneCache.get(cacheKey);

  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return NextResponse.json({ zones: cached.zones, source: "cache" });
  }

  const fallbackZones = dedupeAndSort(getCatalogZones(city));

  try {
    const providerZones = await fetchZonesFromPostalApi(city);
    if (providerZones && providerZones.length > 0) {
      const merged = dedupeAndSort([...providerZones, ...fallbackZones]);
      zoneCache.set(cacheKey, { zones: merged, cachedAt: now });
      return NextResponse.json({ zones: merged, source: "provider" });
    }
  } catch {
    // Fallback below keeps the form functional if the provider fails.
  }

  zoneCache.set(cacheKey, { zones: fallbackZones, cachedAt: now });
  return NextResponse.json({ zones: fallbackZones, source: "fallback" });
}

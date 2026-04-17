import { cityZones } from "@/lib/platformCatalog";
import type { RiskLevel } from "@/types/platform";

export interface ExternalTriggerCandidate {
  externalId: string;
  type: string;
  severity: RiskLevel;
  city: string;
  zone: string;
  source: string;
  title: string;
  description: string;
  impactHours: number;
  payoutMultiplier: number;
  isActive: boolean;
  startsAt: Date;
  endsAt: Date;
  metadata: Record<string, unknown>;
}

export type TriggerLocation = {
  city: string;
  zone: string;
};

type ZoneCoordinates = {
  latitude: number;
  longitude: number;
};

type WeatherResponse = {
  current?: {
    temperature_2m?: number;
    precipitation?: number;
    weather_code?: number;
  };
};

type AirQualityResponse = {
  current?: {
    pm2_5?: number;
    us_aqi?: number;
  };
};

type GeocodingResponse = {
  results?: Array<{
    latitude?: number;
    longitude?: number;
    country_code?: string;
  }>;
};

type ZoneReading = {
  city: string;
  zone: string;
  temperatureC: number | null;
  precipitationMm: number | null;
  weatherCode: number | null;
  pm25: number | null;
  usAqi: number | null;
  weatherSource: string | null;
  airSource: string | null;
};

type OpenWeatherResponse = {
  weather?: Array<{ id?: number }>;
  main?: { temp?: number };
  rain?: { "1h"?: number; "3h"?: number };
};

type AqicnResponse = {
  status?: string;
  data?: {
    aqi?: number;
    iaqi?: {
      pm25?: { v?: number };
    };
  };
};

type WeatherSignal = {
  temperatureC: number | null;
  precipitationMm: number | null;
  weatherCode: number | null;
  source: string;
};

type AirSignal = {
  pm25: number | null;
  usAqi: number | null;
  source: string;
};

const EXTERNAL_FEED_TIMEOUT_MS = Number(process.env.EXTERNAL_FEED_TIMEOUT_MS ?? 5000);
const TRIGGER_WINDOW_HOURS = Number(process.env.REAL_TRIGGER_WINDOW_HOURS ?? 6);
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY ?? "";
const AQICN_API_TOKEN = process.env.AQICN_API_TOKEN ?? "";

const HEAVY_RAIN_CODES = new Set([63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const ZONE_COORDINATE_CACHE = new Map<string, ZoneCoordinates>();

function toZoneKey(city: string, zone: string) {
  return `${city.replace(/\s+/g, "").toLowerCase()}:${zone.replace(/\s+/g, "").toLowerCase()}`;
}

function toToken(value: string) {
  return value.replace(/\s+/g, "").slice(0, 3).toUpperCase();
}

function sanitizeLocationText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function toSeverity(value: number, highThreshold: number, criticalThreshold: number): RiskLevel {
  if (value >= criticalThreshold) return "CRITICAL";
  if (value >= highThreshold) return "HIGH";
  return "MEDIUM";
}

function mapOpenWeatherCodeToWmo(code: number | null): number | null {
  if (code === null) return null;
  if (code >= 200 && code < 300) return 95;
  if (code >= 300 && code < 400) return 53;
  if (code >= 500 && code < 600) return 63;
  if (code >= 600 && code < 700) return 71;
  if (code >= 700 && code < 800) return 45;
  if (code === 800) return 0;
  if (code > 800) return 3;
  return null;
}

async function fetchZoneCoordinates(city: string, zone: string): Promise<ZoneCoordinates | null> {
  const key = toZoneKey(city, zone);
  const cached = ZONE_COORDINATE_CACHE.get(key);
  if (cached) return cached;

  const zoneQuery = encodeURIComponent(`${zone}, ${city}, India`);
  const zoneUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${zoneQuery}&count=1&language=en&format=json`;
  const zoneResult = await fetchJsonWithTimeout<GeocodingResponse>(zoneUrl);
  const zoneCandidate = zoneResult?.results?.find((item) => item.country_code === "IN") ?? zoneResult?.results?.[0];

  if (
    typeof zoneCandidate?.latitude === "number"
    && typeof zoneCandidate.longitude === "number"
  ) {
    const coordinates = { latitude: zoneCandidate.latitude, longitude: zoneCandidate.longitude };
    ZONE_COORDINATE_CACHE.set(key, coordinates);
    return coordinates;
  }

  const cityQuery = encodeURIComponent(`${city}, India`);
  const cityUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${cityQuery}&count=1&language=en&format=json`;
  const cityResult = await fetchJsonWithTimeout<GeocodingResponse>(cityUrl);
  const cityCandidate = cityResult?.results?.find((item) => item.country_code === "IN") ?? cityResult?.results?.[0];

  if (
    typeof cityCandidate?.latitude === "number"
    && typeof cityCandidate.longitude === "number"
  ) {
    const coordinates = { latitude: cityCandidate.latitude, longitude: cityCandidate.longitude };
    ZONE_COORDINATE_CACHE.set(key, coordinates);
    return coordinates;
  }

  return null;
}

async function fetchJsonWithTimeout<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXTERNAL_FEED_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWeatherFromOpenWeather(coords: ZoneCoordinates): Promise<WeatherSignal | null> {
  if (!OPENWEATHER_API_KEY) return null;

  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${coords.latitude}&lon=${coords.longitude}&appid=${OPENWEATHER_API_KEY}&units=metric`;
  const payload = await fetchJsonWithTimeout<OpenWeatherResponse>(url);
  if (!payload) return null;

  const conditionId = typeof payload.weather?.[0]?.id === "number" ? payload.weather[0].id : null;
  const oneHourRain = typeof payload.rain?.["1h"] === "number"
    ? payload.rain["1h"]
    : typeof payload.rain?.["3h"] === "number"
      ? payload.rain["3h"] / 3
      : null;

  return {
    temperatureC: typeof payload.main?.temp === "number" ? payload.main.temp : null,
    precipitationMm: oneHourRain,
    weatherCode: mapOpenWeatherCodeToWmo(conditionId),
    source: "OpenWeather current weather",
  };
}

async function fetchWeatherFromOpenMeteo(coords: ZoneCoordinates): Promise<WeatherSignal | null> {
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,precipitation,weather_code&timezone=auto`;
  const weather = await fetchJsonWithTimeout<WeatherResponse>(weatherUrl);
  if (!weather?.current) return null;

  return {
    temperatureC: typeof weather.current.temperature_2m === "number" ? weather.current.temperature_2m : null,
    precipitationMm: typeof weather.current.precipitation === "number" ? weather.current.precipitation : null,
    weatherCode: typeof weather.current.weather_code === "number" ? weather.current.weather_code : null,
    source: "Open-Meteo weather feed",
  };
}

async function fetchAirFromAqicn(coords: ZoneCoordinates): Promise<AirSignal | null> {
  if (!AQICN_API_TOKEN) return null;

  const url = `https://api.waqi.info/feed/geo:${coords.latitude};${coords.longitude}/?token=${AQICN_API_TOKEN}`;
  const payload = await fetchJsonWithTimeout<AqicnResponse>(url);
  if (payload?.status !== "ok" || !payload.data) return null;

  const pm25 = typeof payload.data.iaqi?.pm25?.v === "number" ? payload.data.iaqi.pm25.v : null;
  const usAqi = typeof payload.data.aqi === "number" ? payload.data.aqi : null;

  return {
    pm25,
    usAqi,
    source: "AQICN air-quality feed",
  };
}

async function fetchAirFromOpenMeteo(coords: ZoneCoordinates): Promise<AirSignal | null> {
  const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${coords.latitude}&longitude=${coords.longitude}&current=pm2_5,us_aqi&timezone=auto`;
  const air = await fetchJsonWithTimeout<AirQualityResponse>(airUrl);
  if (!air?.current) return null;

  return {
    pm25: typeof air.current.pm2_5 === "number" ? air.current.pm2_5 : null,
    usAqi: typeof air.current.us_aqi === "number" ? air.current.us_aqi : null,
    source: "Open-Meteo air quality feed",
  };
}

async function fetchWithFailover<T>(providers: Array<() => Promise<T | null>>): Promise<T | null> {
  for (const provider of providers) {
    try {
      const result = await provider();
      if (result) return result;
    } catch {
      continue;
    }
  }
  return null;
}

async function fetchZoneReading(city: string, zone: string): Promise<ZoneReading | null> {
  const coordinates = await fetchZoneCoordinates(city, zone);
  if (!coordinates) return null;

  const [weatherSignal, airSignal] = await Promise.all([
    fetchWithFailover<WeatherSignal>([
      () => fetchWeatherFromOpenWeather(coordinates),
      () => fetchWeatherFromOpenMeteo(coordinates),
    ]),
    fetchWithFailover<AirSignal>([
      () => fetchAirFromAqicn(coordinates),
      () => fetchAirFromOpenMeteo(coordinates),
    ]),
  ]);

  if (!weatherSignal && !airSignal) return null;

  return {
    city,
    zone,
    temperatureC: weatherSignal?.temperatureC ?? null,
    precipitationMm: weatherSignal?.precipitationMm ?? null,
    weatherCode: weatherSignal?.weatherCode ?? null,
    pm25: airSignal?.pm25 ?? null,
    usAqi: airSignal?.usAqi ?? null,
    weatherSource: weatherSignal?.source ?? null,
    airSource: airSignal?.source ?? null,
  };
}

function buildExternalId(now: Date, type: string, city: string, zone: string) {
  const hourBucket = now.toISOString().slice(0, 13).replace(/[-:T]/g, "");
  return `REAL-${type}-${toToken(city)}-${toToken(zone)}-${hourBucket}`;
}

function buildTriggersFromReading(reading: ZoneReading, now: Date): ExternalTriggerCandidate[] {
  const triggers: ExternalTriggerCandidate[] = [];
  const startsAt = new Date(now.getTime() - 15 * 60 * 1000);
  const endsAt = new Date(now.getTime() + TRIGGER_WINDOW_HOURS * 60 * 60 * 1000);

  const precipitation = reading.precipitationMm ?? 0;
  const weatherCode = reading.weatherCode ?? 0;
  const isHeavyRainCode = HEAVY_RAIN_CODES.has(weatherCode);

  if (precipitation >= 7 || isHeavyRainCode) {
    const severity = toSeverity(Math.max(precipitation, isHeavyRainCode ? 12 : 0), 7, 16);
    triggers.push({
      externalId: buildExternalId(now, "HEAVY_RAIN", reading.city, reading.zone),
      type: "HEAVY_RAIN",
      severity,
      city: reading.city,
      zone: reading.zone,
      source: "Open-Meteo weather feed",
      title: "Live heavy rain alert affecting delivery routes",
      description: "External weather feed reports rainfall conditions that can reduce active delivery hours.",
      impactHours: severity === "CRITICAL" ? 10 : 7,
      payoutMultiplier: severity === "CRITICAL" ? 0.41 : 0.31,
      isActive: true,
      startsAt,
      endsAt,
      metadata: {
        precipitationMm: reading.precipitationMm,
        weatherCode: reading.weatherCode,
        weatherSource: reading.weatherSource,
        airSource: reading.airSource,
      },
    });
  }

  if (precipitation >= 16) {
    triggers.push({
      externalId: buildExternalId(now, "WATERLOGGING", reading.city, reading.zone),
      type: "WATERLOGGING",
      severity: "CRITICAL",
      city: reading.city,
      zone: reading.zone,
      source: "Open-Meteo weather feed",
      title: "Live waterlogging risk in active pickup corridors",
      description: "Rainfall intensity indicates waterlogging and major delivery disruption risk.",
      impactHours: 12,
      payoutMultiplier: 0.45,
      isActive: true,
      startsAt,
      endsAt,
      metadata: {
        precipitationMm: reading.precipitationMm,
        weatherSource: reading.weatherSource,
      },
    });
  }

  const pm25 = reading.pm25 ?? 0;
  const aqi = reading.usAqi ?? 0;
  if (pm25 >= 55 || aqi >= 151) {
    const severity = toSeverity(Math.max(pm25 / 2, aqi / 3), 55 / 2, 85 / 2);
    triggers.push({
      externalId: buildExternalId(now, "SEVERE_POLLUTION", reading.city, reading.zone),
      type: "SEVERE_POLLUTION",
      severity,
      city: reading.city,
      zone: reading.zone,
      source: "Open-Meteo air quality feed",
      title: "Live severe air-quality alert for outdoor workers",
      description: "External AQI feed reports unsafe air levels that can reduce safe outdoor operating hours.",
      impactHours: severity === "CRITICAL" ? 12 : 9,
      payoutMultiplier: severity === "CRITICAL" ? 0.36 : 0.28,
      isActive: true,
      startsAt,
      endsAt,
      metadata: {
        pm25: reading.pm25,
        usAqi: reading.usAqi,
        airSource: reading.airSource,
      },
    });
  }

  const temperature = reading.temperatureC ?? 0;
  if (temperature >= 37) {
    const severity = toSeverity(temperature, 37, 42);
    triggers.push({
      externalId: buildExternalId(now, "EXTREME_HEAT", reading.city, reading.zone),
      type: "EXTREME_HEAT",
      severity,
      city: reading.city,
      zone: reading.zone,
      source: "Open-Meteo weather feed",
      title: "Live extreme heat alert reducing safe rider hours",
      description: "External weather feed reports high heat stress likely to reduce delivery capacity.",
      impactHours: severity === "CRITICAL" ? 8 : 6,
      payoutMultiplier: severity === "CRITICAL" ? 0.33 : 0.24,
      isActive: true,
      startsAt,
      endsAt,
      metadata: {
        temperatureC: reading.temperatureC,
        weatherSource: reading.weatherSource,
      },
    });
  }

  return triggers;
}

export async function fetchLiveTriggersFromOpenMeteo(
  now = new Date(),
  locations: TriggerLocation[] = [],
): Promise<ExternalTriggerCandidate[]> {
  const defaultLocations = cityZones.flatMap((entry) =>
    entry.zones.map((zone) => ({ city: entry.city, zone })),
  );

  const rawLocations = locations.length > 0 ? locations : defaultLocations;

  const seen = new Set<string>();
  const zones = rawLocations
    .map((location) => ({
      city: sanitizeLocationText(location.city),
      zone: sanitizeLocationText(location.zone),
    }))
    .filter((location) => {
      if (!location.city || !location.zone) return false;
      const key = toZoneKey(location.city, location.zone);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const triggerGroups = await Promise.all(
    zones.map(async ({ city, zone }) => {
      const reading = await fetchZoneReading(city, zone);
      if (!reading) return [] as ExternalTriggerCandidate[];
      return buildTriggersFromReading(reading, now);
    }),
  );

  return triggerGroups.flat();
}

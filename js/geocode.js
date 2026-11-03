const geocodeCache = new Map();
const reverseCache = new Map();

async function fetchJson(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
      },
    });
    if (!response.ok) throw new Error(`Geocoder responded ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function geocode(query, language = "en") {
  const trimmed = (query || "").trim();
  if (trimmed.length < 2) return { results: [] };

  const key = `${language}:${trimmed.toLocaleLowerCase()}`;
  const cached = geocodeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const params = new URLSearchParams({
    name: trimmed,
    count: "12",
    language,
    format: "json",
  });
  const data = await fetchJson(
    `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`,
  );

  const results = (data.results ?? [])
    .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
    .map((item) => ({
      id: item.id,
      name: item.name,
      latitude: item.latitude,
      longitude: item.longitude,
      elevation: item.elevation,
      country: item.country,
      countryCode: (item.country_code ?? "").toUpperCase(),
      admin1: item.admin1,
      timezone: item.timezone,
      population: item.population,
    }))
    .sort((a, b) => {
      const belgium = Number(b.countryCode === "BE") - Number(a.countryCode === "BE");
      if (belgium !== 0) return belgium;
      return (b.population ?? 0) - (a.population ?? 0);
    })
    .slice(0, 8);

  const value = { results };
  geocodeCache.set(key, { value, expiresAt: Date.now() + 60 * 60 * 1000 });
  return value;
}

export async function reverseGeocode(latitude, longitude, language = "en") {
  const key = `${language}:${Number(latitude).toFixed(3)}:${Number(longitude).toFixed(3)}`;
  const cached = reverseCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      localityLanguage: language,
    });
    const data = await fetchJson(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?${params.toString()}`,
      8000,
    );

    let cleanAdmin = data.principalSubdivision;
    if (cleanAdmin) {
      const regionMatch = cleanAdmin.match(/^([^,]+),\s*(Région|Province|Gewest)$/i);
      if (regionMatch) cleanAdmin = `${regionMatch[2]} ${regionMatch[1]}`;
    }

    const value = {
      name: data.city || data.locality || "Current location",
      country: data.countryName || "",
      countryCode: (data.countryCode || "").toUpperCase(),
      admin1: cleanAdmin,
      latitude,
      longitude,
    };
    reverseCache.set(key, { value, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
    return value;
  } catch {
    return {
      name: "Current location",
      country: "",
      countryCode: "",
      latitude,
      longitude,
    };
  }
}

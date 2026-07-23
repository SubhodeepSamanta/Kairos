const GEO_TIMEOUT = 6000;
const WMO = {
  0: "clear", 1: "mostly clear", 2: "partly cloudy", 3: "overcast",
  45: "foggy", 48: "freezing fog", 51: "light drizzle", 53: "drizzle", 55: "heavy drizzle",
  61: "light rain", 63: "rain", 65: "heavy rain", 66: "freezing rain", 67: "freezing rain",
  71: "light snow", 73: "snow", 75: "heavy snow", 77: "snow grains",
  80: "light showers", 81: "showers", 82: "heavy showers", 85: "snow showers", 86: "snow showers",
  95: "thunderstorms", 96: "thunderstorms with hail", 99: "severe thunderstorms"
};

let cached = null;

async function getJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEO_TIMEOUT);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "Kairos/1.0" } });
    if (!res.ok) throw new Error(`${url} ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function detectLocation({ force = false } = {}) {
  if (cached && !force) return cached;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  try {
    const d = await getJson("https://ipapi.co/json/");
    cached = {
      city: d.city || null,
      region: d.region || null,
      country: d.country_name || d.country || null,
      latitude: typeof d.latitude === "number" ? d.latitude : null,
      longitude: typeof d.longitude === "number" ? d.longitude : null,
      timezone: d.timezone || timezone
    };
  } catch {
    cached = { city: null, region: null, country: null, latitude: null, longitude: null, timezone };
  }
  return cached;
}

export function cachedLocation() {
  return cached;
}

export function describeLocation(loc) {
  if (!loc) return null;
  const place = [loc.city, loc.region, loc.country].filter(Boolean).join(", ");
  if (!place && !loc.timezone) return null;
  const zone = loc.timezone ? ` (timezone ${loc.timezone})` : "";
  return place ? `${place}${zone}` : `timezone ${loc.timezone}`;
}

async function geocode(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`;
  const data = await getJson(url);
  const hit = data.results?.[0];
  if (!hit) return null;
  return {
    label: [hit.name, hit.admin1, hit.country].filter(Boolean).join(", "),
    latitude: hit.latitude,
    longitude: hit.longitude
  };
}

export async function getWeather(place) {
  let spot = null;
  if (place && String(place).trim()) {
    spot = await geocode(String(place).trim());
    if (!spot) return `I couldn't find a place called "${place}".`;
  } else {
    const loc = await detectLocation();
    if (loc.latitude == null || loc.longitude == null) {
      return "I don't know where you are — tell me a city and I'll check.";
    }
    spot = { label: describeLocation(loc) || "your area", latitude: loc.latitude, longitude: loc.longitude };
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${spot.latitude}&longitude=${spot.longitude}`
    + "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m";
  const data = await getJson(url);
  const c = data.current;
  if (!c) return `I couldn't read the weather for ${spot.label} right now.`;

  const sky = WMO[c.weather_code] ?? "unclear skies";
  const temp = Math.round(c.temperature_2m);
  const feels = Math.round(c.apparent_temperature);
  const feelsPart = Math.abs(feels - temp) >= 2 ? `, feels like ${feels}°` : "";
  const wind = c.wind_speed_10m != null ? `, wind ${Math.round(c.wind_speed_10m)} km/h` : "";
  return `${spot.label}: ${temp}°C, ${sky}${feelsPart}${wind}.`;
}

export function resetLocationForTests() {
  cached = null;
}

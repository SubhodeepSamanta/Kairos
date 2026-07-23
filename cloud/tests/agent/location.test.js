import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { detectLocation, describeLocation, getWeather, resetLocationForTests } from "../../src/agent/location.js";

const realFetch = global.fetch;

function mockFetch(routes) {
  global.fetch = vi.fn(async (url) => {
    for (const [pattern, body] of routes) {
      if (url.includes(pattern)) return { ok: true, status: 200, json: async () => body };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  });
}

beforeEach(() => resetLocationForTests());
afterEach(() => { global.fetch = realFetch; });

describe("detecting where they are", () => {
  it("reads city, region and country from the ip lookup", async () => {
    mockFetch([["ipapi.co", { city: "Kolkata", region: "West Bengal", country_name: "India", latitude: 22.5, longitude: 88.3, timezone: "Asia/Kolkata" }]]);
    const loc = await detectLocation();
    expect(describeLocation(loc)).toMatch(/Kolkata, West Bengal, India/);
  });

  it("falls back to the machine timezone when the lookup fails", async () => {
    mockFetch([]);
    const loc = await detectLocation();
    expect(loc.city).toBeNull();
    expect(loc.timezone).toBeTruthy();
  });

  it("caches so it does not hit the network twice", async () => {
    mockFetch([["ipapi.co", { city: "Paris", country_name: "France", latitude: 48.8, longitude: 2.3 }]]);
    await detectLocation();
    await detectLocation();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe("weather", () => {
  it("reports current conditions for a named place", async () => {
    mockFetch([
      ["geocoding-api", { results: [{ name: "Tokyo", country: "Japan", latitude: 35.6, longitude: 139.7 }] }],
      ["api.open-meteo.com/v1/forecast", { current: { temperature_2m: 18.4, apparent_temperature: 17.1, weather_code: 2, wind_speed_10m: 11 } }]
    ]);
    const report = await getWeather("Tokyo");
    expect(report).toMatch(/Tokyo/);
    expect(report).toMatch(/18°C/);
    expect(report).toMatch(/partly cloudy/);
  });

  it("uses the detected location when no place is given", async () => {
    mockFetch([
      ["ipapi.co", { city: "Berlin", country_name: "Germany", latitude: 52.5, longitude: 13.4, timezone: "Europe/Berlin" }],
      ["api.open-meteo.com/v1/forecast", { current: { temperature_2m: 9, apparent_temperature: 9, weather_code: 61, wind_speed_10m: 4 } }]
    ]);
    const report = await getWeather("");
    expect(report).toMatch(/Berlin/);
    expect(report).toMatch(/light rain/);
  });

  it("says so when the place cannot be found", async () => {
    mockFetch([["geocoding-api", { results: [] }]]);
    const report = await getWeather("Nowhereville");
    expect(report).toMatch(/couldn't find/i);
  });
});

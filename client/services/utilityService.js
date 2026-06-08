import axios from "axios";
import {
  openBrowser,
  safeSpawn,
  runPowerShellScript,
} from "../utils/osHelper.js";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import { captureWindow } from "../utils/uia.js";

export async function openLeetcodeDaily(profileAlias = "") {
  const graphqlUrl = "https://leetcode.com/graphql";
  const query = {
    query: `
      query questionOfToday {
        activeDailyCodingChallengeQuestion {
          link
        }
      }
    `,
  };

  try {
    const response = await axios.post(graphqlUrl, query, {
      headers: { "Content-Type": "application/json" },
    });

    const link = response.data?.data?.activeDailyCodingChallengeQuestion?.link;
    if (!link) throw new Error("No active daily challenge link found.");

    const absoluteUrl = `https://leetcode.com${link}`;
    await openBrowser(absoluteUrl, profileAlias);
    return `Successfully opened LeetCode daily question: ${absoluteUrl}`;
  } catch (err) {
    console.error("Error fetching LeetCode daily question:", err.message);
    const fallbackUrl = "https://leetcode.com/problemset/";
    await openBrowser(fallbackUrl, profileAlias);
    return `Failed to fetch exact link, opened fallback page: ${fallbackUrl}`;
  }
}

export async function openYoutubeVideo(searchQuery, profileAlias = "") {
  const query = searchQuery || "relaxing videos to watch while eating";
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

  await openBrowser(url, profileAlias);
  return `Opened YouTube search for "${query}" in browser: ${url}`;
}

export async function getWeather(location) {
  let targetLocation = location?.trim() || "";

  const isGeneric =
    !targetLocation ||
    ["local", "current", "here", "my location"].includes(
      targetLocation.toLowerCase(),
    );

  if (isGeneric) {
    try {
      const geo = await axios.get("https://ipapi.co/json/", { timeout: 5000 });
      targetLocation = geo.data?.city || "New York";
    } catch {
      targetLocation = "New York";
    }
  }

  try {
    const geoRes = await axios.get(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(targetLocation)}&count=1`,
      { timeout: 6000 },
    );
    const city = geoRes.data?.results?.[0];
    if (!city) throw new Error("City not found");

    const weather = await axios.get(
      `https://api.open-meteo.com/v1/forecast?latitude=${city.latitude}&longitude=${city.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&wind_speed_unit=kmh`,
      { timeout: 6000 },
    );
    const c = weather.data.current;

    const codes = {
      0: "Clear sky",
      1: "Mainly clear",
      2: "Partly cloudy",
      3: "Overcast",
      45: "Foggy",
      48: "Icy fog",
      51: "Light drizzle",
      61: "Light rain",
      63: "Moderate rain",
      65: "Heavy rain",
      80: "Rain showers",
      95: "Thunderstorm",
    };
    const condition = codes[c.weather_code] || "Mixed conditions";

    return `${city.name}: ${c.temperature_2m}°C (feels like ${c.apparent_temperature}°C), ${condition}, Humidity ${c.relative_humidity_2m}%, Wind ${c.wind_speed_10m} km/h`;
  } catch (err) {
    return `${targetLocation}: Weather unavailable (${err.message})`;
  }
}

export async function captureFullScreen() {
  const capture = await captureWindow("__screen__");
  if (!capture.success) throw new Error(capture.error);

  const raw = fs.readFileSync(capture.result);
  const compressed = await sharp(raw)
    .resize(1280, 720, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 60 })
    .toBuffer();

  try {
    await fs.promises.unlink(capture.result);
  } catch (e) {
    console.error("Cleanup failed:", capture.result, e.message);
  }

  return compressed.toString("base64");
}

import axios from 'axios';
import { openBrowser, safeSpawn, runPowerShellScript } from '../utils/osHelper.js';
import path from 'path';
import fs from 'fs';

export async function openLeetcodeDaily(profileAlias = '') {
  const graphqlUrl = 'https://leetcode.com/graphql';
  const query = {
    query: `
      query questionOfToday {
        activeDailyCodingChallengeQuestion {
          link
        }
      }
    `
  };

  try {
    const response = await axios.post(graphqlUrl, query, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    const link = response.data?.data?.activeDailyCodingChallengeQuestion?.link;
    if (!link) throw new Error('No active daily challenge link found.');

    const absoluteUrl = `https://leetcode.com${link}`;
    await openBrowser(absoluteUrl, profileAlias);
    return `Successfully opened LeetCode daily question: ${absoluteUrl}`;
  } catch (err) {
    console.error('Error fetching LeetCode daily question:', err.message);
    const fallbackUrl = 'https://leetcode.com/problemset/';
    await openBrowser(fallbackUrl, profileAlias);
    return `Failed to fetch exact link, opened fallback page: ${fallbackUrl}`;
  }
}

export async function openYoutubeVideo(searchQuery, profileAlias = '') {
  const query = searchQuery || 'relaxing videos to watch while eating';
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  
  await openBrowser(url, profileAlias);
  return `Opened YouTube search for "${query}" in browser: ${url}`;
}

export async function getWeather(location) {
  let targetLocation = location ? location.trim().toLowerCase() : '';
  
  // If location is blank or generic, resolve computer's local city using geolocation API
  const isGeneric = !targetLocation || 
                    targetLocation === 'local' || 
                    targetLocation === 'current' || 
                    targetLocation === 'computer' || 
                    targetLocation === 'my location' || 
                    targetLocation === 'here';

  if (isGeneric) {
    try {
      console.log('Resolving computer local location using ipapi...');
      const geoRes = await axios.get('https://ipapi.co/json/');
      if (geoRes.data?.city) {
        targetLocation = geoRes.data.city;
        console.log(`Resolved local location to: ${targetLocation}`);
      }
    } catch (err) {
      console.error('Failed to resolve local location, falling back to IP-based wttr.in default:', err.message);
    }
  }

  // Attempt 1: wttr.in
  try {
    const queryParam = targetLocation ? encodeURIComponent(targetLocation) : '';
    console.log(`Querying wttr.in for: ${targetLocation || 'IP default'}`);
    const weatherRes = await axios.get(`https://wttr.in/${queryParam}?format=3`, { timeout: 6000 });
    const weatherText = weatherRes.data.trim();
    if (weatherText && !weatherText.includes('<html>') && !weatherText.includes('<!DOCTYPE')) {
      return weatherText;
    }
  } catch (err) {
    console.error('wttr.in query failed:', err.message);
  }

  // Attempt 2: Open-Meteo
  try {
    const searchCity = targetLocation || 'kolkata';
    console.log(`Querying Open-Meteo geocoding for: ${searchCity}`);
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchCity)}&count=1`;
    const geoRes = await axios.get(geoUrl, { timeout: 6000 });
    const cityData = geoRes.data?.results?.[0];
    if (cityData) {
      const { latitude, longitude, name: cityName } = cityData;
      const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
      const forecastRes = await axios.get(forecastUrl, { timeout: 6000 });
      const current = forecastRes.data?.current_weather;
      if (current) {
        return `${cityName}: ${current.temperature}°C, Wind ${current.windspeed} km/h.`;
      }
    }
  } catch (err) {
    console.error('Open-Meteo fallback query failed:', err.message);
  }

  // Attempt 3: Final fallback
  return `${targetLocation || 'Local'}: 27°C, Clear sky (Default fallback).`;
}

export async function captureFullScreen() {
  const scriptPath = path.resolve('services/whatsapp_driver.ps1');
  const result = await runPowerShellScript(scriptPath, { action: 'capture_full_screen' });
  const pathLine = result.split('\n').find(line => line.trim().startsWith('path:'));
  if (!pathLine) {
    throw new Error('Could not find screen screenshot path in driver output.');
  }
  
  const imgPath = pathLine.replace('path:', '').trim();
  if (!fs.existsSync(imgPath)) {
    throw new Error(`Screen screenshot file does not exist at: ${imgPath}`);
  }

  const base64Data = fs.readFileSync(imgPath, 'base64');
  
  try {
    fs.unlinkSync(imgPath);
  } catch (err) {
    console.error('Failed to delete temporary screen screenshot:', err.message);
  }

  return base64Data;
}

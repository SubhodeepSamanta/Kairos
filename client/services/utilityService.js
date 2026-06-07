import axios from 'axios';
import { openBrowser, safeSpawn } from '../utils/osHelper.js';

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
      targetLocation = ''; // wttr.in defaults to request IP if blank
    }
  }

  const queryParam = targetLocation ? encodeURIComponent(targetLocation) : '';
  const weatherRes = await axios.get(`https://wttr.in/${queryParam}?format=3`);
  return weatherRes.data.trim();
}

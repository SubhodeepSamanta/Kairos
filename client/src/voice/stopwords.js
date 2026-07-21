const STOP_PHRASES = [
  /^stop$/,
  /^stop it$/,
  /^stop stop$/,
  /^stop please$/,
  /^please stop$/,
  /^cancel$/,
  /^cancel that$/,
  /^cancel it$/,
  /^never ?mind$/,
  /^nevermind$/,
  /^forget it$/,
  /^forget that$/,
  /^wait stop$/,
  /^no stop$/,
  /^abort$/,
  /^quit that$/,
  /^shut up$/,
  /^be quiet$/,
  /^enough$/,
  /^that's enough$/
];

export function isStopPhrase(text) {
  const bare = String(text || "")
    .toLowerCase()
    .replace(/[^a-z' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!bare || bare.split(" ").length > 3) return false;
  return STOP_PHRASES.some(p => p.test(bare));
}

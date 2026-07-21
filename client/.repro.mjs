import { createTranscriber } from "./src/voice/stt.js";
const pcm = new Int16Array(16000 * 2);
for (let i = 0; i < pcm.length; i++) pcm[i] = 3000 * Math.sin(2*Math.PI*150*i/16000);

const stt = createTranscriber();
await stt.ready();
console.log("STT loaded");
console.log("STT before kokoro ->", await stt.transcribe(pcm));

const { createKokoroEngine } = await import("./src/voice/tts/kokoro.js");
const k = createKokoroEngine();
await k.ready();
console.log("Kokoro loaded");

console.log("running STT again after kokoro…");
const out = await stt.transcribe(pcm);
console.log("STT after kokoro ->", out);
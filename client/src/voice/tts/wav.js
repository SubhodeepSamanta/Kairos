export function toInt16(samples, volume = 1) {
  if (samples instanceof Int16Array && volume === 1) return samples;
  const out = new Int16Array(samples.length);
  const isFloat = !(samples instanceof Int16Array);
  for (let i = 0; i < samples.length; i++) {
    const value = isFloat ? samples[i] * 32767 : samples[i];
    const scaled = value * volume;
    out[i] = scaled > 32767 ? 32767 : scaled < -32768 ? -32768 : Math.round(scaled);
  }
  return out;
}

export function encodeWav(samples, sampleRate, { volume = 1 } = {}) {
  const pcm = toInt16(samples, volume);
  const dataBytes = pcm.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataBytes, 40);

  for (let i = 0; i < pcm.length; i++) buffer.writeInt16LE(pcm[i], 44 + i * 2);
  return buffer;
}

export function silenceWav(ms, sampleRate = 24000) {
  return encodeWav(new Int16Array(Math.round((sampleRate * ms) / 1000)), sampleRate);
}

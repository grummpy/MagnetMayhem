/** Live Web Audio chiptune and effects. No audio files. */

function midiToHz(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function makeNoise(ctx) {
  const length = Math.floor(ctx.sampleRate * 0.25);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let s = 12345;
  for (let i = 0; i < length; i++) {
    s = (Math.imul(s, 1103515245) + 12345) | 0;
    data[i] = ((s >>> 16) & 0xffff) / 32768 - 1;
  }
  return buffer;
}

export function createAudio() {
  let ctx = null;
  let master = null;
  let themeGain = null;
  let sfxGain = null;
  let noise = null;
  let muted = false;
  let volume = 0.8;
  let themeOn = false;
  let nextNote = 0;
  let stepIndex = 0;
  const lead = [57, 60, 64, 67, 64, 60, 62, 67];

  function applyVolume() {
    if (master) master.gain.value = muted ? 0 : volume;
  }

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
      master = ctx.createGain();
      themeGain = ctx.createGain();
      sfxGain = ctx.createGain();
      themeGain.connect(master);
      sfxGain.connect(master);
      master.connect(ctx.destination);
      themeGain.gain.value = 0.9;
      sfxGain.gain.value = 1;
      noise = makeNoise(ctx);
      applyVolume();
    } catch {
      ctx = null;
      return false;
    }
    return true;
  }

  function tone(time, freq, dur, type, gain, dest) {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    amp.gain.setValueAtTime(gain, time);
    amp.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(amp);
    amp.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  function noiseBurst(time, dur, gain, freq) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const amp = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, time);
    amp.gain.setValueAtTime(gain, time);
    amp.gain.exponentialRampToValueAtTime(0.001, time + dur);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(sfxGain);
    src.start(time);
    src.stop(time + dur + 0.01);
  }

  function sfx(name) {
    if (!ensure() || muted || volume <= 0) return;
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    if (name === 'hit') {
      noiseBurst(t, 0.09, 0.4, 700);
      tone(t, 160, 0.1, 'square', 0.07, sfxGain);
    } else if (name === 'wall') {
      noiseBurst(t, 0.05, 0.16, 220);
    } else if (name === 'capture') {
      tone(t, 640, 0.06, 'square', 0.06, sfxGain);
      tone(t + 0.045, 920, 0.08, 'square', 0.05, sfxGain);
    } else if (name === 'fling') {
      noiseBurst(t, 0.12, 0.28, 480);
      tone(t, 220, 0.14, 'sawtooth', 0.05, sfxGain);
    } else if (name === 'burst') {
      tone(t, 280, 0.08, 'square', 0.07, sfxGain);
      tone(t + 0.06, 480, 0.1, 'square', 0.06, sfxGain);
      noiseBurst(t, 0.1, 0.22, 900);
    } else if (name === 'flip') {
      tone(t, 520, 0.07, 'square', 0.05, sfxGain);
    } else if (name === 'ko') {
      tone(t, 300, 0.18, 'sawtooth', 0.07, sfxGain);
      tone(t + 0.1, 140, 0.3, 'triangle', 0.08, sfxGain);
    } else if (name === 'beep') {
      tone(t, 880, 0.12, 'square', 0.07, sfxGain);
    } else if (name === 'go') {
      tone(t, 660, 0.09, 'square', 0.08, sfxGain);
      tone(t + 0.09, 990, 0.16, 'square', 0.08, sfxGain);
    } else if (name === 'round') {
      [523, 659, 784, 1046].forEach((freq, i) => tone(t + i * 0.08, freq, 0.16, 'square', 0.06, sfxGain));
    } else if (name === 'match') {
      [392, 523, 659, 784, 1046].forEach((freq, i) => tone(t + i * 0.1, freq, 0.22, 'square', 0.07, sfxGain));
    }
  }

  return {
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      themeOn = true;
    },
    update() {
      if (!ctx || !themeOn) return;
      const t = ctx.currentTime;
      if (nextNote < t) nextNote = t + 0.02;
      while (nextNote < t + 0.28) {
        if (!muted && volume > 0) {
          const midi = lead[stepIndex % lead.length];
          tone(nextNote, midiToHz(midi), 0.2, 'square', 0.04, themeGain);
          if (stepIndex % 2 === 0) tone(nextNote, midiToHz(midi - 12), 0.24, 'triangle', 0.035, themeGain);
        }
        stepIndex = (stepIndex + 1) % lead.length;
        nextNote += 0.27;
      }
    },
    sfx,
    setVolume(v) {
      volume = v;
      applyVolume();
    },
    setMuted(m) {
      muted = !!m;
      applyVolume();
    },
  };
}

/** Browser text-to-speech; no-op when unavailable (e.g. SSR or missing API). */

function waitForVoices(timeoutMs = 2500): Promise<void> {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return Promise.resolve();
  }
  const synth = window.speechSynthesis;
  if (synth.getVoices().length > 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const done = () => {
      synth.removeEventListener("voiceschanged", done);
      resolve();
    };
    synth.addEventListener("voiceschanged", done);
    window.setTimeout(() => {
      synth.removeEventListener("voiceschanged", done);
      resolve();
    }, timeoutMs);
  });
}

function pickEnglishVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  if (voices.length === 0) return null;
  const preferLocal = voices.find((v) => v.lang.toLowerCase().startsWith("en") && v.localService);
  if (preferLocal) return preferLocal;
  const anyEn = voices.find((v) => v.lang.toLowerCase().startsWith("en"));
  return anyEn ?? voices[0] ?? null;
}

/**
 * Speak plain text. Waits for voices (Chromium loads them async) and works around Chrome
 * leaving the queue in a paused state after speak().
 */
export async function speakText(text: string): Promise<void> {
  const plain = text.replace(/\s+/g, " ").trim();
  if (!plain) return;

  if (typeof window === "undefined" || !window.speechSynthesis) {
    return;
  }

  const synth = window.speechSynthesis;
  await waitForVoices();

  await new Promise<void>((resolve) => {
    synth.cancel();

    // Let cancel flush before queuing (avoids Chrome eating the new utterance).
    window.setTimeout(() => {
      const u = new SpeechSynthesisUtterance(plain);
      u.lang = "en-US";
      const voice = pickEnglishVoice();
      if (voice) {
        u.voice = voice;
      }
      u.rate = 1;
      u.pitch = 1;
      u.volume = 1;

      const finish = () => resolve();
      u.onend = finish;
      u.onerror = finish;

      synth.speak(u);

      // Chrome often starts paused; resume nudges playback.
      const nudge = () => {
        try {
          if (synth.paused) synth.resume();
        } catch {
          /* ignore */
        }
      };
      nudge();
      window.requestAnimationFrame(nudge);
      window.setTimeout(nudge, 50);
      window.setTimeout(nudge, 250);

      // Safety: don't hang workflow forever if events never fire
      window.setTimeout(finish, Math.min(120_000, plain.length * 80 + 5000));
    }, 0);
  });
}

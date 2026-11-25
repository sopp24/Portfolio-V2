# Audio

Plain ES modules, no build, no audio files. Silent until `engine.start()` is called from a click.

| File | Role |
| --- | --- |
| `engine.js` | Public API. Owns the `AudioContext`, the bus graph (sfx / ambience → compressor → fade → master) and the music object. |
| `sfx.js` | 23 synthesized effects (noise bursts, filtered sweeps, inharmonic bells). Randomized pitch on every play. Works on any `BaseAudioContext`, so it can be rendered offline for tests. |
| `ambience.js` | Room tone, 50 Hz mains hum, muffled street with random car pass-bys, vinyl-crackle bed, rare creaks. One look-ahead `setTimeout` chain on the audio clock; cleared on stop/dispose. Ducks while music plays (the crackle bed almost disappears). |
| `youtube-music.js` | Official YouTube IFrame Player API (`youtube-nocookie.com`). Lazy: nothing loads before `music.enable()`. |

## Usage

```js
const audio = createAudioEngine();             // default video: RSXMwOvUui4
audio.music.mount(document.querySelector("#radio"));  // before start(): moving an iframe reloads it
await audio.start({ music: true });            // inside a click handler
audio.sfx("vinyl-pull");
audio.stop();                                  // leave the store
```

SFX names: `hover click vinyl-pull vinyl-return flip sleeve-open sleeve-close disc-slide needle-drop door-open door-close neon-on lights-on register cat-tap secret paper page chat-open chat-message error zoom`.

## YouTube: limits and honesty

- **Visible player.** YouTube's embedded-player policy requires the player to be visible and at least 200×200 px. The player lives in `div.music-player` (200×200); the UI must show it (a small "radio" card). Without `mount()` it is pinned bottom-left. Do not hide it with `display:none`/`visibility:hidden`.
- **Autoplay.** Starting needs a user gesture. `start({music:true})` calls `enable()`+`play()` without awaiting. If the browser still blocks autoplay, the state becomes `paused` and the visitor presses play.
- **Embedding disabled** (error 101/150) → `state: "blocked"`; 2/5/100, API load failure or timeout (10 s / 15 s) → `state: "error"`. Nothing throws.
- **Random start.** Once per visit, after the first `playing` event. For a finite video: seek to a random second in `[0, duration-60]`. For a live stream: only possible when the stream has a DVR window (`getDuration()` > 120 s); a seek into it is attempted. The result is **verified** with `getCurrentTime()` 2.5 s later and reported as `randomStart: "applied"`, otherwise `"unavailable"` (live edge kept). `"not-applicable"` = very short video. A live stream without DVR cannot be seeked: this is a YouTube limit, not something we can work around. Whether `RSXMwOvUui4` exposes a DVR window could not be tested from the build sandbox (YouTube is unreachable there), so treat the random start as best-effort until verified in a real browser.
- Not tested from the sandbox: actual YouTube playback, the real `getDuration()` of this live stream, autoplay behavior on iOS Safari.

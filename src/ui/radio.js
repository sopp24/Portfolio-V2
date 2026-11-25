// Radio card for the official YouTube player. YouTube's policy requires the embedded player to be
// visible at >= 200x200 px, so it lives in this card; "hide" is a user choice that moves the card
// off-screen AND pauses the music, so the player is never playing while hidden.
// The hidden card is `inert` (no focusable controls).
import { $ } from "./dom.js";
import { t } from "../core/i18n.js";

export function createRadio({ audio, isTouch }) {
  const card = $("#radio-card");
  const open = $("#radio-open");
  const playBtn = $("#radio-play");
  const muteBtn = $("#radio-mute");
  const volume = $("#radio-volume");
  const status = $("#radio-status");
  let collapsed = false;          // visible whenever music is enabled (YouTube requires a visible player)
  void isTouch;
  let enabled = false;

  audio.music.mount($("#radio-player"));

  function render() {
    const s = audio.music.getStatus();
    const label = t("audio.state." + s.state);
    const extras = [];
    if (s.title) extras.push(s.title);
    if (s.randomStart === "applied") extras.push(t("audio.random.applied"));
    if (s.randomStart === "unavailable") extras.push(t("audio.random.unavailable"));
    status.textContent = [label, ...extras].join(" · ");
    playBtn.textContent = s.state === "playing" ? "❚❚" : "▶";
    playBtn.setAttribute("aria-label", s.state === "playing" ? t("audio.pause") : t("audio.play"));
    muteBtn.textContent = audio.music.isMuted() ? "🔇" : "♪";
    muteBtn.setAttribute("aria-label", audio.music.isMuted() ? t("audio.unmute") : t("audio.mute"));
    card.hidden = !enabled;
    open.hidden = !enabled || !collapsed;
    card.classList.toggle("is-offscreen", collapsed);
    card.inert = collapsed;
  }

  playBtn.addEventListener("click", () => audio.music.toggle());
  muteBtn.addEventListener("click", () => { audio.music.setMuted(!audio.music.isMuted()); render(); });
  volume.addEventListener("input", () => audio.music.setVolume(Number(volume.value) / 100));
  $("#radio-collapse").addEventListener("click", () => { if (audio.music.isPlaying()) audio.music.pause(); collapsed = true; render(); });
  audio.music.setVolume(Number(volume.value) / 100); // the slider and the player start from the same value
  open.addEventListener("click", () => { collapsed = false; render(); });
  audio.on("change", render);

  return {
    setEnabled(v) { enabled = !!v; render(); },
    render,
    expand() { collapsed = false; render(); }
  };
}

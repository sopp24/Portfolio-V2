import("./src/app.js").catch(error => {
  // Three.js est chargé depuis un CDN : s'il est injoignable, tout le module échoue.
  // On remplace l'écran de chargement figé par un message et un bouton pour réessayer.
  console.error("SIDE A: the experience could not be loaded.", error);
  const loading = document.getElementById("loading");
  if (!loading) return;
  const french = /^fr/i.test(document.documentElement.lang || navigator.language || "");
  const line = loading.querySelector("p");
  if (line) {
    line.textContent = french
      ? "IMPOSSIBLE DE CHARGER LA 3D. VÉRIFIE TA CONNEXION."
      : "THE 3D SCENE COULD NOT LOAD. CHECK YOUR CONNECTION.";
  }
  const bar = loading.querySelector(".loading-line");
  if (bar) bar.hidden = true;
  const retry = document.createElement("button");
  retry.type = "button";
  retry.textContent = french ? "Réessayer" : "Try again";
  retry.style.cssText = "margin-top:18px;padding:10px 18px;border:1px solid rgba(240,230,211,.4);border-radius:999px;color:inherit;background:none;font:inherit;font-size:12px;cursor:pointer";
  retry.addEventListener("click", () => window.location.reload());
  loading.appendChild(retry);
});

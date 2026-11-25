import { boot } from "./app.js";

boot().catch((error) => {
  console.error("Boot failed", error);
  const loading = document.getElementById("loading");
  if (loading) loading.hidden = true;
  // nothing could start (old browser, missing import map support, failed module): show the static, crawlable content
  document.documentElement.classList.add("boot-failed");
});

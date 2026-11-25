import { boot } from "./app.js";

boot().catch((error) => {
  console.error("Boot failed", error);
  const loading = document.getElementById("loading");
  if (loading) loading.hidden = true;
});

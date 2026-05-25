import { defineConfig } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://argentinametals.com",
  output: "static",
  trailingSlash: "never",
  integrations: [
    react(),
    sitemap({ filter: (page) => !page.includes("/admin") && !page.includes("/subscribe/") })
  ]
});
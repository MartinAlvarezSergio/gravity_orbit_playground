import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/gravity_orbit_playground/",
  plugins: [react()]
});

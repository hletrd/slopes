import { defineConfig } from "vite";
import vinext from "vinext";

export default defineConfig({
  base: '/vinext/',
  plugins: [vinext()],
});

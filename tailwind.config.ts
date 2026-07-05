import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#0B0B0D",
        panel: "#141417",
        panel2: "#1B1B20",
        line: "#26262C",
        mut: "#8B8B95",
        acc: "#F2A900",
        accdim: "#B87F00",
      },
      fontFamily: {
        disp: ["Space Grotesk", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;

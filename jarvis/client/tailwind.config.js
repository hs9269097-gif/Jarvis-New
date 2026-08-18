/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#04070d",
        abyss: "#060b14",
        panel: "#0a1220",
        line: "rgba(120,180,255,0.10)",
        cyan: {
          DEFAULT: "#22d3ee",
          bright: "#7ff3ff",
        },
        neon: "#2f9bff",
        violet: "#8b5cf6",
        ink: "#e6f1ff",
        mut: "#7d93b2",
        dim: "#4a5c78",
      },
      fontFamily: {
        sans: ['"Segoe UI"', "system-ui", "-apple-system", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ['"JetBrains Mono"', '"SF Mono"', "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px -6px rgba(34,211,238,0.45)",
        "glow-lg": "0 0 60px -10px rgba(34,211,238,0.55)",
        panel: "0 24px 60px -30px rgba(0,0,0,0.9)",
      },
      keyframes: {
        scanline: { "0%": { transform: "translateY(-100%)" }, "100%": { transform: "translateY(100%)" } },
        spinSlow: { "0%": { transform: "rotate(0deg)" }, "100%": { transform: "rotate(360deg)" } },
        pulseSoft: { "0%,100%": { opacity: "0.5" }, "50%": { opacity: "1" } },
        flicker: { "0%,100%": { opacity: "1" }, "92%": { opacity: "1" }, "93%": { opacity: "0.6" }, "94%": { opacity: "1" } },
        floatY: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
      },
      animation: {
        scanline: "scanline 6s linear infinite",
        "spin-slow": "spinSlow 22s linear infinite",
        "spin-slower": "spinSlow 40s linear infinite",
        "pulse-soft": "pulseSoft 3s ease-in-out infinite",
        flicker: "flicker 8s linear infinite",
        "float-y": "floatY 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

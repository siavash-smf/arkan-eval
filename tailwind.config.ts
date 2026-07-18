import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // پالت برند آرکان — هم‌راستا با بقیه‌ی فازهای پروژه
        pine: "#143A32",
        brass: "#B5853A",
        bone: "#F7F3EC",
        sand: "#E7DECF",
        ink: "#15201C",
        slate: "#5A5F5B",
        // رنگ‌های مخصوص ارزیابی — سه حالت نمره‌دهی گلدن‌ست
        pass: "#2F7A55",
        partial: "#B5853A",
        fail: "#B0473C",
      },
      fontFamily: {
        heading: ["var(--font-estedad)", "system-ui", "sans-serif"],
        body: ["var(--font-vazirmatn)", "system-ui", "sans-serif"],
      },
      borderRadius: { card: "12px", btn: "8px" },
      boxShadow: { soft: "0 1px 3px rgba(21,32,28,.06), 0 8px 24px rgba(21,32,28,.05)" },
      maxWidth: { content: "80rem" },
    },
  },
  plugins: [],
};

export default config;

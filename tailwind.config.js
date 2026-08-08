/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--color-canvas) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        "surface-alt": "rgb(var(--color-surface-alt) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        body: "rgb(var(--color-body) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        "accent-soft": "rgb(var(--color-accent-soft) / <alpha-value>)",
        rose: "rgb(var(--color-rose) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
        success: "rgb(var(--color-success) / <alpha-value>)",
        warning: "rgb(var(--color-warning) / <alpha-value>)",
        destructive: "rgb(var(--color-destructive) / <alpha-value>)",
        "on-ink": "rgb(var(--color-on-ink) / <alpha-value>)",
        "on-destructive": "rgb(var(--color-on-destructive) / <alpha-value>)",
        "on-warning": "rgb(var(--color-on-warning) / <alpha-value>)",
      },
      fontFamily: {
        display: ["PlayfairDisplay_700Bold"],
        "display-bold": ["PlayfairDisplay_800ExtraBold"],
        body: ["Inter_400Regular"],
        "body-medium": ["Inter_500Medium"],
        "body-semibold": ["Inter_600SemiBold"],
      },
      fontSize: {
        micro: ["11px", "16px"],
        label: ["10px", "14px"],
        section: ["12px", "16px"],
        sm: ["13px", "20px"],
        base: ["15px", "24px"],
        lg: ["17px", "27px"],
        h3: ["22px", "28px"],
        h2: ["26px", "32px"],
        h1: ["32px", "34px"],
        display: ["40px", "40px"],
      },
      letterSpacing: {
        display: "-0.8px",
        heading: "-0.4px",
        label: "2.5px",
        section: "2.4px",
      },
      borderRadius: {
        control: "12px", // buttons, inputs, chips
        panel: "16px", // list containers
        card: "20px", // cards
        overlay: "24px", // sheets, modals
        pill: "999px",
      },
      // Dark-mode rules are specified as `border-border/12` (§11), and 12 is
      // not on Tailwind's default opacity scale — without this the class
      // silently generates nothing and the border renders at full opacity.
      opacity: {
        12: "0.12",
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        "2xl": "32px",
        "3xl": "56px",
      },
    },
  },
  plugins: [],
};

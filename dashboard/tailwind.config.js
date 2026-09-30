module.exports = {
  darkMode: ["class", ".rb-theme-dark, .chakra-ui-dark"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        border: "var(--border, var(--rb-panel-border))",
        input: "var(--input, var(--rb-panel-border))",
        ring: "var(--ring, var(--rb-panel-accent))",
        background: "var(--background, var(--rb-panel-bg))",
        foreground: "var(--foreground, var(--rb-panel-text))",
        primary: {
          DEFAULT: "var(--primary, var(--rb-panel-accent))",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "var(--secondary, var(--rb-panel-elevated))",
          foreground: "var(--secondary-foreground, var(--rb-panel-text))",
        },
        destructive: {
          DEFAULT: "#ef4444",
          foreground: "#ffffff",
        },
        muted: {
          DEFAULT: "var(--muted, var(--rb-panel-elevated))",
          foreground: "var(--muted-foreground, var(--rb-panel-text-muted))",
        },
        accent: {
          DEFAULT: "var(--accent, var(--rb-panel-elevated))",
          foreground: "var(--accent-foreground, var(--rb-panel-text))",
        },
        popover: {
          DEFAULT: "var(--popover, var(--rb-panel-surface))",
          foreground: "var(--popover-foreground, var(--rb-panel-text))",
        },
        card: {
          DEFAULT: "var(--card, var(--rb-panel-surface))",
          foreground: "var(--card-foreground, var(--rb-panel-text))",
        },
        panel: {
          surface: "var(--rb-panel-surface)",
          elevated: "var(--rb-panel-elevated)",
          border: "var(--rb-panel-border)",
          borderStrong: "var(--rb-panel-border-strong)",
          text: "var(--rb-panel-text)",
          textSecondary: "var(--rb-panel-text-secondary)",
          textMuted: "var(--rb-panel-text-muted)",
          accent: "var(--rb-panel-accent)",
          accentHover: "var(--rb-panel-accent-hover)",
        },
      },
      borderRadius: {
        lg: "16px",
        md: "10px",
        sm: "6px",
        xl: "20px",
        "2xl": "24px",
      },
      transitionTimingFunction: {
        DEFAULT: "cubic-bezier(0.2, 0, 0, 1)",
      },
      transitionDuration: {
        DEFAULT: "200ms",
      },
    },
  },
  plugins: [],
};

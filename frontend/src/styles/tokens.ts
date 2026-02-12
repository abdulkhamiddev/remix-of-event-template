export const spacingScale = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.5rem",
  "2xl": "2rem",
  "3xl": "3rem",
} as const;

export const radiusScale = {
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.5rem",
} as const;

export const typographyScale = {
  label: "0.75rem",
  body: "0.9375rem",
  headingSm: "1.125rem",
  headingMd: "1.5rem",
  headingLg: "2rem",
} as const;

export const surfaceTokens = {
  card: "rounded-2xl border border-border/60 bg-card/75 backdrop-blur-xl shadow-sm",
  elevated: "rounded-3xl border border-border/70 bg-card/90 backdrop-blur-xl shadow-md",
  subtle: "rounded-xl border border-border/50 bg-card/60 backdrop-blur",
} as const;

export const borderOpacity = {
  low: "border-border/40",
  medium: "border-border/60",
  high: "border-border/80",
} as const;

import tokens from './tokens.json' with { type: 'json' };

export { tokens };

/**
 * Generates CSS Variables string for injection into web and admin global stylesheets.
 */
export function generateCssVariables() {
  const { brand, theme, stateMachine, trust, spacing, radius, elevation, motion } = tokens;

  return `:root {
  /* Brand */
  --vx-brand-primary: ${brand.primary};
  --vx-brand-primary-hover: ${brand.primaryHover};
  --vx-brand-secondary: ${brand.secondary};
  --vx-brand-secondary-hover: ${brand.secondaryHover};
  --vx-brand-accent: ${brand.accent};
  --vx-brand-accent-hover: ${brand.accentHover};

  /* Default Dark Theme (First-Class Esports Mode) */
  --vx-bg: ${theme.dark.bg};
  --vx-surface: ${theme.dark.surface};
  --vx-surface-elevated: ${theme.dark.surfaceElevated};
  --vx-surface-highlight: ${theme.dark.surfaceHighlight};
  --vx-border: ${theme.dark.border};
  --vx-border-subtle: ${theme.dark.borderSubtle};
  --vx-text-primary: ${theme.dark.textPrimary};
  --vx-text-secondary: ${theme.dark.textSecondary};
  --vx-text-muted: ${theme.dark.textMuted};

  /* Trust Indicators */
  --vx-trust-verified: ${trust.verifiedBadge};
  --vx-trust-hash-tick: ${trust.hashCheckTick};
  --vx-trust-rules: ${trust.rulesPublished};
  --vx-trust-formula: ${trust.formulaVersion};

  /* Spacing */
  --vx-space-xs: ${spacing.xs};
  --vx-space-sm: ${spacing.sm};
  --vx-space-md: ${spacing.md};
  --vx-space-lg: ${spacing.lg};
  --vx-space-xl: ${spacing.xl};
  --vx-space-2xl: ${spacing.2xl};
  --vx-space-3xl: ${spacing.3xl};
  --vx-space-4xl: ${spacing.4xl};

  /* Radius */
  --vx-radius-sm: ${radius.sm};
  --vx-radius-md: ${radius.md};
  --vx-radius-lg: ${radius.lg};
  --vx-radius-xl: ${radius.xl};
  --vx-radius-full: ${radius.full};

  /* Elevation */
  --vx-shadow-card: ${elevation.card};
  --vx-shadow-modal: ${elevation.modal};
  --vx-shadow-glow-primary: ${elevation.glowPrimary};
  --vx-shadow-glow-accent: ${elevation.glowAccent};

  /* Motion */
  --vx-motion-fast: ${motion.fast};
  --vx-motion-normal: ${motion.normal};
  --vx-motion-slow: ${motion.slow};
}

[data-theme="light"] {
  --vx-bg: ${theme.light.bg};
  --vx-surface: ${theme.light.surface};
  --vx-surface-elevated: ${theme.light.surfaceElevated};
  --vx-surface-highlight: ${theme.light.surfaceHighlight};
  --vx-border: ${theme.light.border};
  --vx-border-subtle: ${theme.light.borderSubtle};
  --vx-text-primary: ${theme.light.textPrimary};
  --vx-text-secondary: ${theme.light.textSecondary};
  --vx-text-muted: ${theme.light.textMuted};
}
`;
}

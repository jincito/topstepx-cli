import ansis from 'ansis';

export { ansis };

/** Semantic color theme for the CLI */
export const theme = {
  header: ansis.bold.cyan,
  success: ansis.green,
  error: ansis.red,
  warning: ansis.yellow,
  muted: ansis.gray,
  value: ansis.white,
  label: ansis.bold,
} as const;

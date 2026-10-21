export const palette = {
  bg: '#0b0b0d',
  surface: '#141418',
  elevated: '#1d1d22',
  highlight: '#2a2a31',
  border: '#26262c',
  text: '#ffffff',
  textSecondary: '#a9a9b3',
  textTertiary: '#6d6d78',
  danger: '#f26b6b',
  overlay: 'rgba(0,0,0,0.6)',
} as const;

/** Accent colours, named like a car's ambient lighting presets. */
export const ACCENTS = [
  { name: 'Emerald', value: '#1ed760' },
  { name: 'Polar Blue', value: '#4f9dff' },
  { name: 'Amethyst', value: '#a78bfa' },
  { name: 'Rosé', value: '#f472b6' },
  { name: 'Sunset Amber', value: '#fb923c' },
  { name: 'Racing Red', value: '#f2555a' },
  { name: 'Ice Teal', value: '#2dd4bf' },
  { name: 'Champagne', value: '#e9c46a' },
] as const;

export const DEFAULT_ACCENT = ACCENTS[0].value;

export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Mixes a hex colour toward black; used to tame bright artwork colours behind white text. */
export function darken(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = 1 - amount;
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex.slice(0, 7)}${a}`;
}

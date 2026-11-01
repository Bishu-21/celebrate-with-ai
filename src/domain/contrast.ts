export const PALETTE = {
  background: "#09080C",
  foreground: "#F6F1EA",
  primary: "#C2410C",
  primaryDark: "#9A3412",
  onPrimary: "#FFFFFF",
  sage: "#146B4A",
  onSage: "#FFFFFF",
  ok: "#6FBF8B",
  gold: "#F3D2A4",
  muted: "#17141C",
  danger: "#FB7185",
  dangerStrong: "#9F1239",
} as const;

function channel(hex: string, start: number): number {
  const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const normalized = hex.replace("#", "");
  const red = channel(normalized, 0);
  const green = channel(normalized, 2);
  const blue = channel(normalized, 4);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

export const CONTRAST_PAIRS = [
  { name: "body text", foreground: PALETTE.foreground, background: PALETTE.background, minimum: 4.5 },
  { name: "primary button", foreground: PALETTE.onPrimary, background: PALETTE.primary, minimum: 4.5 },
  { name: "primary hover", foreground: PALETTE.onPrimary, background: PALETTE.primaryDark, minimum: 4.5 },
  { name: "sage badge", foreground: PALETTE.onSage, background: PALETTE.sage, minimum: 4.5 },
  { name: "estimate label", foreground: PALETTE.gold, background: PALETTE.background, minimum: 4.5 },
  { name: "danger text", foreground: PALETTE.danger, background: PALETTE.background, minimum: 4.5 },
  { name: "success text", foreground: PALETTE.ok, background: PALETTE.background, minimum: 4.5 },
  { name: "danger badge", foreground: PALETTE.onPrimary, background: PALETTE.dangerStrong, minimum: 4.5 },
  { name: "muted panel text", foreground: PALETTE.foreground, background: PALETTE.muted, minimum: 4.5 },
] as const;

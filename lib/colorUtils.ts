/** hex カラーの Hue を保ちつつパステル背景色（HSL）を返す */
export function toPastelBg(
  hex: string | null | undefined,
  lightness = 96,
  saturation = 55,
): string | undefined {
  if (!hex || !hex.startsWith("#") || hex.length < 7) return undefined;

  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `hsl(${Math.round(h * 360)}, ${saturation}%, ${lightness}%)`;
}

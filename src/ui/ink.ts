/** Navy or white text, whichever reads on a block of `color`. CSS variables (no team colours) get white. */
export const inkOn = (color: string): string => {
  const m = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return '#fff';
  const n = parseInt(m[1], 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return lum > 0.3 ? '#0b1220' : '#fff';
};

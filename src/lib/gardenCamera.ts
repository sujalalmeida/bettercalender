export function gardenViewBox(
  width: number,
  height: number,
  position = 0.5,
): [number, number, number, number] {
  const ratio = Math.max(0.1, width / Math.max(1, height));
  if (ratio < 1.6) {
    const viewWidth = 1000 * ratio;
    return [
      (1600 - viewWidth) * Math.max(0, Math.min(1, position)),
      0,
      viewWidth,
      1000,
    ];
  }
  const viewHeight = 1600 / ratio;
  return [0, (1000 - viewHeight) * 0.45, 1600, viewHeight];
}

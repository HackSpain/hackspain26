export const TV_MIN_SIZE = 8;

export function clampTv(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

export function layoutTvBox(input: {
  x: number;
  y: number;
  w: number;
  h: number;
}) {
  const w = clampTv(input.w, TV_MIN_SIZE, 100);
  const h = clampTv(input.h, TV_MIN_SIZE, 100);
  return {
    x: clampTv(input.x, 0, 100 - w),
    y: clampTv(input.y, 0, 100 - h),
    w,
    h,
  };
}

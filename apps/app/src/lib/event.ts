/** Highlight delivery during the final three hours of the configured event. */
export function isSubmitFeatured(
  endsAt: number | undefined,
  now = Date.now()
): boolean {
  return (
    endsAt !== undefined && now >= endsAt - 3 * 60 * 60 * 1000 && now < endsAt
  );
}

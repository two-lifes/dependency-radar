export const GUEST_COOKIE = "radar-guest";
export const GUEST_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

export function validGuestId(value: string | undefined): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

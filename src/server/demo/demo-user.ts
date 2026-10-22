/**
 * The one shared demo account (plan.md "Демо"). A fixed id lets every check
 * ask "is this the demo?" without a database column.
 */
export const DEMO_USER = {
  id: "demo",
  name: "Demo user",
  // `.invalid` never resolves, so no email can reach anyone.
  email: "demo@dependency-radar.invalid",
} as const;

export function isDemoUser(userId: string): boolean {
  return userId === DEMO_USER.id;
}

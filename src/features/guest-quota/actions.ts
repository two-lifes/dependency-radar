"use server";
import { readGuestQuota } from "@/server/guest-quota";
export async function refreshGuestQuota() {
  return readGuestQuota();
}

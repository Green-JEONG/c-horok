import type { ReactNode } from "react";
import { ensureHorokLogMemberProfile } from "@/lib/horok-coding-profile";

export default async function HorokLogLayout({
  children,
}: {
  children: ReactNode;
}) {
  await ensureHorokLogMemberProfile();

  return children;
}

import type { ReactNode } from "react";
import { ensureHorokCodingMemberProfile } from "@/lib/horok-coding-profile";

export default async function HorokCodingLayout({
  children,
}: {
  children: ReactNode;
}) {
  await ensureHorokCodingMemberProfile();

  return children;
}

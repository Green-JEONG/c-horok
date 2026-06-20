"use client";

import { ChevronRight } from "lucide-react";
import { MYPAGE_HEADING_SLOT_ID } from "@/components/mypage/mypage-heading-ids";

export { MYPAGE_HEADING_SLOT_ID, MYPAGE_HEADING_ACTIONS_SLOT_ID } from "@/components/mypage/mypage-heading-ids";

export default function MyPageHeading() {
  return (
    <>
      <span className="shrink-0">마이페이지</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span
        id={MYPAGE_HEADING_SLOT_ID}
        className="min-w-0 truncate"
        suppressHydrationWarning
      />
    </>
  );
}

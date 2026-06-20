"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { MYPAGE_HEADING_ACTIONS_SLOT_ID } from "@/components/mypage/mypage-heading-ids";
import { useHydratedPortalTarget } from "@/lib/use-hydrated-portal-target";

type Props = {
  children: ReactNode;
  disabled?: boolean;
};

export default function MyPageHeadingActionsPortal({
  children,
  disabled,
}: Props) {
  const slot = useHydratedPortalTarget(MYPAGE_HEADING_ACTIONS_SLOT_ID, disabled);

  if (!slot) {
    return null;
  }

  return createPortal(children, slot);
}

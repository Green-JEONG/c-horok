"use client";

import { Crown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  image?: string | null;
  role?: "USER" | "ADMIN" | null;
  href?: string;
  ariaLabel?: string;
  className?: string;
};

export default function CommentAuthorHeader({
  name,
  image = null,
  role = null,
  href,
  ariaLabel,
  className,
}: Props) {
  const profile = (
    <>
      <Image
        src={image ?? "/logo.png"}
        alt={`${name} 프로필`}
        width={28}
        height={28}
        className={cn(
          "h-7 w-7 shrink-0 rounded-full border object-cover",
          !image && "grayscale",
        )}
      />
      <span className="truncate">{name}</span>
    </>
  );

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 text-sm font-medium leading-7",
        className,
      )}
    >
      {href ? (
        <Link
          href={href}
          className="inline-flex min-w-0 items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={ariaLabel ?? `${name} 홈으로 이동`}
        >
          {profile}
        </Link>
      ) : (
        <span className="inline-flex min-w-0 items-center gap-2">{profile}</span>
      )}
      {role === "ADMIN" ? (
        <Crown
          aria-label="관리자"
          className="h-4 w-4 shrink-0 fill-amber-300 text-amber-500"
        />
      ) : null}
    </div>
  );
}

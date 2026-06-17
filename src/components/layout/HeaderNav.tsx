"use client";

import clsx from "clsx";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    href: "/horok-log/feeds",
    label: "피드",
    match: (p: string) =>
      p === "/horok-log/feeds" || p.startsWith("/horok-log/feeds/"),
  },
  {
    href: "/horok-log/likes",
    label: "북마크",
    match: (p: string) => p.startsWith("/horok-log/likes"),
  },
  {
    href: "/horok-coding",
    label: "코딩테스트",
    icon: ExternalLink,
    openInNewTab: true,
    match: (p: string) => p === "/horok-coding" || p.startsWith("/horok-coding/"),
  },
  {
    href: "/horok-log/notices",
    label: "공지사항",
    match: (p: string) =>
      p === "/horok-log/notices" || p.startsWith("/horok-log/notices/"),
  },
];

export default function HeaderNav() {
  const pathname = usePathname();

  return (
    <nav className="grid w-full grid-cols-4 gap-2 text-sm font-medium md:flex md:w-auto md:grid-cols-none md:items-center md:gap-5">
      {navItems.map((item) => {
        const isActive = item.match(pathname);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            target={item.openInNewTab ? "_blank" : undefined}
            rel={item.openInNewTab ? "noopener noreferrer" : undefined}
            className={clsx(
              "flex min-w-0 items-center justify-center gap-1.5 border-b-2 px-2 py-0.5 text-center whitespace-nowrap transition-colors",
              isActive
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {Icon ? (
              <Icon aria-hidden="true" className="size-3.5 shrink-0" />
            ) : null}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

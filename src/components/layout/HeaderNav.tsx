"use client";

import clsx from "clsx";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    href: "/horok-tech/feeds",
    label: "소식",
    match: (p: string) =>
      p === "/horok-tech/feeds" || p.startsWith("/horok-tech/feeds/"),
  },
  {
    href: "/horok-tech/likes",
    label: "북마크",
    match: (p: string) => p.startsWith("/horok-tech/likes"),
  },
  {
    href: "/horok-cote",
    label: "코딩테스트",
    icon: ExternalLink,
    openInNewTab: true,
    match: (p: string) => p === "/horok-cote" || p.startsWith("/horok-cote/"),
  },
  {
    href: "/horok-tech/notices",
    label: "공지사항",
    match: (p: string) =>
      p === "/horok-tech/notices" || p.startsWith("/horok-tech/notices/"),
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

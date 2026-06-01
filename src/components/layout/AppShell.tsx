"use client";

import { usePathname } from "next/navigation";

type AppShellProps = {
  header: React.ReactNode;
  banner: React.ReactNode;
  sidebar: React.ReactNode;
  footer: React.ReactNode;
  chat: React.ReactNode;
  children: React.ReactNode;
};

export default function AppShell({
  header,
  banner,
  sidebar,
  footer,
  chat,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const topLevelSegment = pathname.split("/")[1] ?? "";
  const knownTopLevelSegments = new Set([
    "",
    "admin",
    "blog",
    "chat",
    "coding-tests",
    "feed",
    "feeds",
    "horok-cote",
    "horok-shop",
    "horok-tech",
    "horok-tv",
    "likes",
    "mypage",
    "notices",
    "posts",
    "search",
    "users",
    "videos",
  ]);
  const isPortalPage = pathname === "/";
  const isHorokTechLikePage = pathname.startsWith("/horok-tech");
  const isLegacyHorokTechPage =
    pathname === "/likes" ||
    pathname.startsWith("/likes/") ||
    pathname === "/notices" ||
    pathname.startsWith("/notices/") ||
    pathname === "/posts" ||
    pathname.startsWith("/posts/");
  const isMyPage = pathname === "/mypage";
  const isSearchPage = pathname === "/search";
  const isUserProfilePage =
    pathname === "/users" || pathname.startsWith("/users/");
  const isHorokCotePage =
    pathname === "/horok-cote" || pathname.startsWith("/horok-cote/");
  const isStandaloneServicePage =
    isHorokCotePage ||
    pathname === "/horok-tv" ||
    pathname.startsWith("/horok-tv/") ||
    pathname === "/horok-shop" ||
    pathname.startsWith("/horok-shop/");
  const isUnknownTopLevelPath =
    pathname !== "/" && !knownTopLevelSegments.has(topLevelSegment);
  const isWideNotFoundCandidatePage =
    !isPortalPage &&
    !isStandaloneServicePage &&
    !pathname.startsWith("/api") &&
    (isHorokTechLikePage ||
      isMyPage ||
      isSearchPage ||
      isUserProfilePage ||
      isUnknownTopLevelPath ||
      pathname.startsWith("/horok-tech") ||
      pathname.startsWith("/mypage") ||
      pathname.startsWith("/search") ||
      pathname.startsWith("/users/"));
  const isWideSidebarLayoutPage =
    isHorokTechLikePage ||
    isMyPage ||
    isSearchPage ||
    isUserProfilePage ||
    isWideNotFoundCandidatePage;
  const isChatEnabledPage =
    isHorokTechLikePage ||
    isLegacyHorokTechPage ||
    isSearchPage ||
    isMyPage ||
    isUserProfilePage;
  if (isPortalPage || isStandaloneServicePage) {
    return (
      <>
        <main className="min-h-dvh">{children}</main>
        {isChatEnabledPage ? chat : null}
      </>
    );
  }

  const mainLayoutClassName = isMyPage
    ? "mr-auto flex h-[calc(100dvh-190px)] w-full max-w-[1400px] flex-1 overflow-hidden md:h-[calc(100dvh-134px)]"
    : isWideSidebarLayoutPage
      ? "mr-auto flex w-full max-w-[1400px] flex-1 md:min-h-0 md:overflow-hidden"
      : "mx-auto flex w-full max-w-6xl flex-1 md:min-h-0 md:overflow-hidden";

  const asideClassName = isWideSidebarLayoutPage
    ? "sticky top-0 hidden h-full w-[250px] shrink-0 md:block lg:w-[270px] xl:w-[290px]"
    : "sticky top-0 hidden h-full w-1/4 md:block";

  const sectionWrapperClassName = isMyPage
    ? "relative w-full min-h-0 overflow-hidden md:flex-1"
    : isWideSidebarLayoutPage
      ? "relative w-full md:min-h-0 md:flex-1"
      : "relative w-full md:min-h-0 md:w-2/3";

  const sectionContentClassName = isMyPage
    ? "h-full w-full p-6"
    : isWideSidebarLayoutPage
      ? "scrollbar-hide h-full w-full p-6 md:overflow-y-auto"
      : "scrollbar-hide h-full w-full px-4 py-6 md:overflow-y-auto md:px-6";

  return (
    <>
      {header}
      {banner}
      <main className={mainLayoutClassName} data-app-shell-main="true">
        <aside className={asideClassName}>
          <div className="relative flex h-full flex-col px-6 py-6">
            <div className="pointer-events-none absolute inset-y-6 right-0 w-px bg-border" />
            <div className="space-y-8">{sidebar}</div>
            {footer}
          </div>
        </aside>

        <section className={sectionWrapperClassName}>
          <div className="pointer-events-none absolute inset-y-6 right-0 hidden w-px bg-border md:block" />
          <div className={sectionContentClassName}>{children}</div>
        </section>
      </main>
      {isChatEnabledPage ? chat : null}
    </>
  );
}

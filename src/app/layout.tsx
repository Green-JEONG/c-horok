import type { Metadata } from "next";
import { Suspense } from "react";

import HorokChat from "@/components/chat/HorokChat";
import RecommendedCategories from "@/components/home/RecommendedCategories";
import AppShell from "@/components/layout/AppShell";
import BannerBar from "@/components/layout/BannerBar";
import Header from "@/components/layout/Header";
import LoginWelcomeToast from "@/components/layout/LoginWelcomeToast";
import AuthSessionProvider from "@/components/providers/SessionProvider";
import PopularPosts from "@/components/sidebar/PopularPosts";
import UserActivityRanking from "@/components/sidebar/UserActivityRanking";
import UserProfiles from "@/components/sidebar/UserProfiles";
// import RecommendedKeywords from "@/components/sidebar/RecommendedKeywords";
import "@/app/globals.css";
import { getSiteUrl } from "@/lib/site-url";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "c.horok | 호록 컴퍼니",
  description: "오늘의 기록이 내일의 기술이 되는 곳",
  openGraph: {
    title: "오늘의 기록이 내일의 기술이 되는 곳",
    description: "함께 공부하고, 기록하고, 나누세요.",
    url: siteUrl,
    siteName: "c.Horok",
    images: [
      {
        url: "/logo.png",
        alt: "Horok Logo",
      },
    ],
    locale: "ko_KR",
    type: "website",
  },
};

const themeScript = `
(() => {
  const storageKey = "theme";
  const root = document.documentElement;
  const savedTheme = window.localStorage.getItem(storageKey);
  const theme = savedTheme === "light" || savedTheme === "dark"
    ? savedTheme
    : "dark";

  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script>{themeScript}</script>
      </head>
      <body className="flex min-h-dvh flex-col overflow-x-hidden">
        <AuthSessionProvider>
          <LoginWelcomeToast />
          <AppShell
            header={<Header />}
            banner={<BannerBar />}
            sidebar={
              <>
                <UserProfiles />
                <PopularPosts />
                {/* <RecommendedKeywords /> */}
                <Suspense fallback={null}>
                  <RecommendedCategories />
                </Suspense>
                <UserActivityRanking />
              </>
            }
            footer={
              <footer className="mt-auto text-center text-xs text-muted-foreground">
                © 2026 |{" "}
                <a
                  href="https://github.com/Green-JEONG/c-horok"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-primary hover:text-primary/80 hover:underline"
                >
                  c.horok
                </a>{" "}
                | All rights reserved.
              </footer>
            }
            chat={
              <Suspense fallback={null}>
                <HorokChat />
              </Suspense>
            }
          >
            {children}
          </AppShell>
        </AuthSessionProvider>
      </body>
    </html>
  );
}

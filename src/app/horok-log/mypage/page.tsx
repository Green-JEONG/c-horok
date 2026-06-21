import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import MyPageHeading, {
  MYPAGE_HEADING_ACTIONS_SLOT_ID,
} from "@/components/mypage/MyPageHeading";
import MyPageSection from "@/components/mypage/MyPageSection";
import { getCategoryBySlug } from "@/lib/categories";
import { horokLogTitle } from "@/lib/page-titles";

export const metadata: Metadata = {
  title: horokLogTitle("마이페이지"),
  description: "마이 페이지",
  robots: {
    index: false,
    follow: false,
  },
};

type Props = {
  searchParams: Promise<{ category?: string }>;
};

export default async function MyPage({ searchParams }: Props) {
  const { category } = await searchParams;
  const categorySlug = category?.trim();
  const selectedCategory = categorySlug
    ? await getCategoryBySlug(categorySlug, { requireVisiblePosts: false })
    : null;

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3">
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {selectedCategory ? (
          <h1 className="inline-flex min-w-0 shrink-0 items-center gap-1 text-lg font-semibold">
            <span className="truncate">마이홈</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="shrink-0">카테고리</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{selectedCategory.name}</span>
          </h1>
        ) : (
          <h1 className="inline-flex min-w-0 shrink-0 items-center gap-1 text-lg font-semibold">
            <Suspense fallback={<span className="shrink-0">마이페이지</span>}>
              <MyPageHeading />
            </Suspense>
          </h1>
        )}
        <div
          id={MYPAGE_HEADING_ACTIONS_SLOT_ID}
          className="flex min-w-0 w-full flex-row items-center justify-end gap-2 sm:ml-auto sm:w-auto"
          suppressHydrationWarning
        />
      </div>
      <div className="min-h-0 flex-1">
        <Suspense fallback={<MyPageLoading />}>
          <MyPageSection />
        </Suspense>
      </div>
    </div>
  );
}

function MyPageLoading() {
  return (
    <div className="space-y-6">
      <div className="h-6 w-32 rounded bg-muted animate-pulse" />
      <div className="h-48 rounded bg-muted animate-pulse" />
      <div className="h-48 rounded bg-muted animate-pulse" />
    </div>
  );
}

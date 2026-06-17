import { PenSquare } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import PostEditor from "@/components/posts/PostEditor";
import {
  INQUIRY_TAG_OPTIONS,
  NOTICE_TAG_OPTIONS,
} from "@/lib/notice-categories";
import { horokLogTitle } from "@/lib/page-titles";

export const metadata: Metadata = {
  title: horokLogTitle("공지 작성"),
  description: "공지사항 및 문의 작성 페이지",
  robots: {
    index: false,
    follow: false,
  },
};

function getNoticeCategoryLabel(category: string) {
  return category === "QnA" ? "문의" : category;
}

export default async function HorokLogNewNoticePage({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string }>;
}) {
  const session = await auth();

  if (!session) {
    redirect("/horok-log/notices");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const isAdmin = session.user.role === "ADMIN";
  const fixedTagOptions = isAdmin
    ? NOTICE_TAG_OPTIONS.filter((option) => option !== "버그 제보")
    : ["QnA"];
  const requestedCategory =
    typeof resolvedSearchParams?.category === "string"
      ? resolvedSearchParams.category
      : null;
  const initialCategoryName =
    requestedCategory && fixedTagOptions.includes(requestedCategory as never)
      ? requestedCategory
      : isAdmin
        ? NOTICE_TAG_OPTIONS[0]
        : "QnA";

  return (
    <main className="w-full">
      <div className="mb-6 flex items-center gap-2">
        <PenSquare className="h-[18px] w-[18px]" />
        <h1 className="text-lg font-bold tracking-tight">
          {getNoticeCategoryLabel(initialCategoryName)} 작성
        </h1>
      </div>
      <PostEditor
        initialCategoryName={initialCategoryName}
        categoryLocked
        successPathPrefix="/horok-log/notices"
        fixedTagOptions={fixedTagOptions}
        inquiryTagOptions={INQUIRY_TAG_OPTIONS}
        showCategoryField={false}
        showBannerOption
        allowNoticeBannerForAllCategories={isAdmin}
      />
    </main>
  );
}

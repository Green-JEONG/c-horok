import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { horokLogTitle } from "@/lib/page-titles";

export const metadata: Metadata = {
  title: horokLogTitle("글 작성"),
  description: "글 작성 페이지",
};

export default function LegacyWritePostPage() {
  redirect("/horok-log/feeds/posts/new");
}

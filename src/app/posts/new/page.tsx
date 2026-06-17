import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "New Post | c.horok",
  description: "글 작성 페이지",
};

export default function LegacyWritePostPage() {
  redirect("/horok-log/feeds/posts/new");
}

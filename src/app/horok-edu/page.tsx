import type { Metadata } from "next";
import { horokEduTitle } from "@/lib/page-titles";

export const metadata: Metadata = {
  title: horokEduTitle("호록 교육"),
  description: "호록 교육 콘텐츠 페이지",
  alternates: {
    canonical: "/horok-edu",
  },
};

export default function HorokEduPage() {
  return (
    <section>
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">교육</h2>
        <p className="text-sm text-muted-foreground">
          교육 콘텐츠는 현재 준비 중입니다.
        </p>
      </div>
    </section>
  );
}

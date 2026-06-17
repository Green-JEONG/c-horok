import type { Metadata } from "next";
import { horokItemTitle } from "@/lib/page-titles";

export const metadata: Metadata = {
  title: horokItemTitle("호록 굿즈"),
  description: "호록 컴퍼니의 브랜드와 굿즈를 소개하는 아이템 페이지",
  alternates: {
    canonical: "/horok-item",
  },
};

export default function HorokItemPage() {
  return (
    <section>
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">굿즈</h2>
        <p className="text-sm text-muted-foreground">
          호록 컴퍼니의 브랜드 상품과 굿즈는 현재 준비 중입니다.
        </p>
      </div>
    </section>
  );
}

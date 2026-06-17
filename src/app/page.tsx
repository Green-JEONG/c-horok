import type { Metadata } from "next";
import RootPortal from "@/components/root/RootPortal";

export const metadata: Metadata = {
  title: "c.horok | 호록 컴퍼니",
  description:
    "호록 컴퍼니 소개와 기술 블로그, 코딩테스트, 기술 영상, 호록샵으로 이동할 수 있는 포털 페이지",
  alternates: {
    canonical: "/",
  },
};

export default function Page() {
  return <RootPortal />;
}

import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function LegacyNoticeDetailPage({ params }: Props) {
  const { slug } = await params;
  redirect(`/horok-log/notices/${slug}`);
}

import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function LegacyPostPage({ params }: Props) {
  const { id } = await params;
  redirect(`/horok-log/feeds/posts/${id}`);
}

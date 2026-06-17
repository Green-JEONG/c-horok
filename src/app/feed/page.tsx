import { redirect } from "next/navigation";

export default function LegacyFeedPage() {
  redirect("/horok-log/feeds");
}

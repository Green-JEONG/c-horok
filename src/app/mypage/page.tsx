import { redirect } from "next/navigation";
import { getLogMyPagePath } from "@/lib/routes";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LegacyMyPageRedirect({ searchParams }: Props) {
  const params = await searchParams;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      query.set(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        query.append(key, entry);
      }
    }
  }

  const queryString = query.toString();
  redirect(getLogMyPagePath(queryString));
}

import type { MetadataRoute } from "next";
import { listHorokCoteProblems } from "@/lib/horok-cote";
// import { getSiteUrl } from "@/lib/site-url"; // 이 함수가 non-www를 주면 문제가 반복됨.

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://c-horok.com";
  const horokCoteProblems = await listHorokCoteProblems();

  return [
    {
      url: baseUrl, // https://c-horok.com (끝에 / 없음)
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/horok-tech`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: `${baseUrl}/horok-tech/feeds`, // 끝에 / X
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/horok-tech/notices`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/horok-tv`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/horok-cote`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/horok-shop`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    ...horokCoteProblems.map((problem) => ({
      url: `${baseUrl}/horok-cote/${problem.number}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}

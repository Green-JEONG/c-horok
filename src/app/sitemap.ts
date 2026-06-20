import type { MetadataRoute } from "next";
import { listHorokCodingProblems } from "@/lib/horok-coding";
// import { getSiteUrl } from "@/lib/site-url"; // 이 함수가 non-www를 주면 문제가 반복됨.

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://c-horok.com";
  const horokCodingProblems = await listHorokCodingProblems();

  return [
    {
      url: baseUrl, // https://c-horok.com (끝에 / 없음)
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/horok-log`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: `${baseUrl}/horok-log/feeds`, // 끝에 / X
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/horok-log/notices`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/horok-academy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/horok-coding`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/horok-item`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    ...horokCodingProblems.map((problem) => ({
      url: `${baseUrl}/horok-coding/${problem.number}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}

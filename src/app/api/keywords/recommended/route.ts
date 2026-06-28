import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [stopRows, postRows] = await Promise.all([
    prisma.stopWord.findMany({
      select: { word: true },
    }),
    prisma.post.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
        isDeleted: false,
        isHidden: false,
        isSecret: false,
      },
      select: { title: true, content: true },
    }),
  ]);

  const stopWords = new Set(stopRows.map((row) => row.word.toLowerCase()));
  const counter = new Map<string, number>();

  for (const post of postRows) {
    const text = `${post.title} ${post.content}`;
    const words = text.split(/\s+/);

    for (const raw of words) {
      const word = raw.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
      if (!word || word.length < 2) continue;
      if (stopWords.has(word)) continue;

      counter.set(word, (counter.get(word) ?? 0) + 1);
    }
  }

  const keywords = Array.from(counter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));

  return NextResponse.json(keywords);
}

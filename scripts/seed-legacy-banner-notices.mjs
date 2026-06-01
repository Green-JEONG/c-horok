import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Missing DATABASE_URL");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
  log: ["error"],
});

const notices = [
  {
    title:
      "호록 기술 블로그가 2026년 1월 6일부로 개설되었어요! 많은 관심 가져 주세요.  🎉",
    content: [
      "호록 기술 블로그가 2026년 1월 6일부로 개설되었어요! 많은 관심 가져 주세요.  🎉",
      "기존 배너에서 안내하던 오픈 문구를 공지사항 게시물로도 함께 보관합니다.",
      "앞으로 서비스 오픈, 주요 변경, 운영 안내는 공지사항과 배너에 함께 반영됩니다.",
    ].join("\n\n"),
    createdAt: new Date("2026-01-06T00:00:00.000Z"),
  },
  {
    title: "2026년 붉은🔥 말🐴의 해가 밝았어요. 새해 복 많이 받으세요!",
    content: [
      "2026년 붉은🔥 말🐴의 해가 밝았어요. 새해 복 많이 받으세요!",
      "배너에 노출되던 새해 인사 문구도 공지사항 게시물로 함께 저장합니다.",
      "앞으로 배너에 보여주는 운영 메시지는 가능한 한 공지사항 데이터와 같은 원본을 사용합니다.",
    ].join("\n\n"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  },
];

try {
  const adminUser = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { id: "asc" },
    select: { id: true, email: true },
  });

  if (!adminUser) {
    throw new Error("No admin user found");
  }

  const category = await prisma.category.upsert({
    where: { slug: "공지" },
    update: { name: "공지" },
    create: { name: "공지", slug: "공지" },
    select: { id: true },
  });

  const existing = await prisma.post.findMany({
    where: {
      isDeleted: false,
      categoryId: category.id,
      title: { in: notices.map((notice) => notice.title) },
    },
    select: { id: true, title: true, isBanner: true },
  });

  const existingTitles = new Set(existing.map((post) => post.title));
  const toUpdate = existing.filter((post) => !post.isBanner);
  const toCreate = notices.filter(
    (notice) => !existingTitles.has(notice.title),
  );

  if (toUpdate.length === 0 && toCreate.length === 0) {
    console.log("No banner notice changes");
  } else {
    await prisma.$transaction([
      ...toUpdate.map((post) =>
        prisma.post.update({
          where: { id: post.id },
          data: { isBanner: true },
        }),
      ),
      ...toCreate.map((notice) =>
        prisma.post.create({
          data: {
            userId: adminUser.id,
            categoryId: category.id,
            title: notice.title,
            content: notice.content,
            isBanner: true,
            createdAt: notice.createdAt,
            updatedAt: notice.createdAt,
          },
        }),
      ),
    ]);

    console.log(
      `Updated ${toUpdate.length} notices, created ${toCreate.length} notices`,
    );
  }
} finally {
  await prisma.$disconnect();
}

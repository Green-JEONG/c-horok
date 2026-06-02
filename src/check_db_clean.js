const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const connectionString =
  "postgresql://postgres.ywsjmibcbhnwjxrpogfm:tynun812795@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres";
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      coteMember: {
        select: {
          nickname: true,
          avatarUrl: true,
        },
      },
    },
  });
  console.log("=== USERS ===");
  console.log(
    JSON.stringify(
      users,
      (key, value) => (typeof value === "bigint" ? value.toString() : value),
      2,
    ),
  );
  await pool.end();
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

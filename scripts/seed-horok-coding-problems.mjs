import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

function loadEnvFile(filePath, override = false) {
  const absolutePath = resolve(process.cwd(), filePath);
  if (!existsSync(absolutePath)) return;

  const source = readFileSync(absolutePath, "utf8");

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    if (!key) continue;
    if (!override && process.env[key] !== undefined) continue;

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local", true);

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Missing DATABASE_URL");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const problems = [
  {
    number: 0,
    slug: "print-hello-horok",
    title: "화면에 문장 출력하기",
    level: "Lv.0",
    category: "출력",
    duration: "1분",
    acceptanceRate: "98%",
    summary: "정해진 문장을 그대로 한 줄 출력하는 가장 기본적인 문제입니다.",
    prompt: "'Hello, Horok!'를 한 줄 그대로 출력하세요.",
    examples: [
      {
        input: "(입력 없음)",
        output: "Hello, Horok!",
        explanation: "",
      },
    ],
    testCases: [
      {
        name: "테스트 케이스 1",
        status: "pending",
        input: "(입력 없음)",
        expected: "Hello, Horok!",
        conditions: [
          {
            text: "콘솔 화면에 문자열을 한 줄 출력하는 기본 출력 기능이 동작해야 합니다.",
            check: { type: "output_not_empty" },
          },
          {
            text: "대소문자가 정확하게 구분되게 'Hello, Horok!'와 완전히 일치해야 합니다.",
            check: { type: "output_equals", value: "Hello, Horok!" },
          },
          {
            text: "문장 끝의 느낌표(!) 기호가 반드시 포함되어야 합니다.",
            check: { type: "output_contains", value: "!" },
          },
        ],
      },
    ],
  },
];

async function main() {
  for (const problem of problems) {
    await prisma.codingProblem.upsert({
      where: { slug: problem.slug },
      update: {
        number: problem.number,
        title: problem.title,
        level: problem.level,
        category: problem.category,
        duration: problem.duration,
        acceptanceRate: problem.acceptanceRate,
        summary: problem.summary,
        prompt: problem.prompt,
        examples: problem.examples,
        testCases: problem.testCases,
      },
      create: problem,
    });
  }

  console.log(`Seeded ${problems.length} horok-coding problem(s).`);
}

main()
  .catch((error) => {
    console.error("Failed to seed horok-coding problems", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

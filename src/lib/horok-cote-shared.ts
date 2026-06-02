export type ConditionCheck =
  | { type: "output_not_empty" }
  | { type: "output_equals"; value: string }
  | { type: "output_contains"; value: string }
  | { type: "output_matches"; pattern: string };

export type HorokCoteCondition = {
  text: string;
  check?: ConditionCheck;
};

export type HorokCoteProblem = {
  number: number;
  slug: string;
  title: string;
  level: string;
  category: string;
  duration: string;
  acceptanceRate: string;
  createdAt?: string;
  summary: string;
  prompt: string;
  examples: Array<{
    input: string;
    output: string;
    explanation: string;
  }>;
  testCases: Array<{
    name: string;
    status: "passed" | "pending";
    input: string;
    expected: string;
    conditions?: HorokCoteCondition[];
  }>;
};

export const HOROK_COTE_LEVELS = [
  "Lv.0",
  "Lv.1",
  "Lv.2",
  "Lv.3",
  "Lv.4",
  "Lv.5",
] as const;

export function getHorokCoteChatThreadTitle(problem: HorokCoteProblem) {
  return `${problem.number}번 ${problem.title}`;
}

export function getHorokCoteChatIntroMessage(problem: HorokCoteProblem) {
  const exampleSummary = problem.examples.slice(0, 1).map((example, index) => {
    const input = example.input.trim();
    const output = example.output.trim();
    const explanation = example.explanation.trim();

    const parts = [
      `예제 ${index + 1}에서는 입력이 "${input}"이고 출력이 "${output}"입니다.`,
    ];

    if (explanation) {
      parts.push(explanation);
    }

    return parts.join(" ");
  })[0];

  return [
    `이번 문제는 ${problem.summary}`,
    `핵심 요구사항은 ${problem.prompt.replace(/\.$/, "")}입니다.`,
    exampleSummary,
    "원하시면 제가 풀이 아이디어부터 예제 해설, 코드 작성까지 같이 도와드릴게요.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

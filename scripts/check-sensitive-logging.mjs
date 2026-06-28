import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src/app/api", "src/lib"];
const EXTENSIONS = new Set([".ts", ".tsx"]);
const SENSITIVE_IDENTIFIER_PATTERN =
  /\b(body|content|password|token|secret|cookie|cookies|header|headers|session|req|request)\b/i;

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walk(path));
      continue;
    }

    const extension = path.slice(path.lastIndexOf("."));
    if (EXTENSIONS.has(extension)) {
      files.push(path);
    }
  }

  return files;
}

function stripStringLiterals(value) {
  return value
    .replace(/`(?:\\[\s\S]|[^`\\])*`/g, "``")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
}

function getConsoleStatements(source) {
  const statements = [];
  const consolePattern = /console\.(?:log|info|warn|error|debug)\s*\(/g;

  for (
    let match = consolePattern.exec(source);
    match;
    match = consolePattern.exec(source)
  ) {
    const index = match.index;
    let cursor = match.index;
    let depth = 0;
    let inString = null;
    let isEscaped = false;

    while (cursor < source.length) {
      const char = source[cursor];

      if (inString) {
        if (isEscaped) {
          isEscaped = false;
        } else if (char === "\\") {
          isEscaped = true;
        } else if (char === inString) {
          inString = null;
        }
        cursor += 1;
        continue;
      }

      if (char === '"' || char === "'" || char === "`") {
        inString = char;
      } else if (char === "(") {
        depth += 1;
      } else if (char === ")") {
        depth -= 1;
      } else if (char === ";" && depth <= 0) {
        cursor += 1;
        break;
      }

      cursor += 1;
    }

    statements.push({
      index,
      text: source.slice(index, cursor),
    });
  }

  return statements;
}

function lineNumberForIndex(source, index) {
  return source.slice(0, index).split("\n").length;
}

const findings = [];

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const source = readFileSync(file, "utf8");
    const statements = getConsoleStatements(source);

    for (const statement of statements) {
      const codeOnly = stripStringLiterals(statement.text);

      if (SENSITIVE_IDENTIFIER_PATTERN.test(codeOnly)) {
        findings.push({
          file,
          line: lineNumberForIndex(source, statement.index),
          statement: statement.text.split("\n")[0].trim(),
        });
      }
    }
  }
}

if (findings.length > 0) {
  console.error("Sensitive logging check failed:");
  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line} ${finding.statement}`);
  }
  process.exit(1);
}

console.log("Sensitive logging check passed.");

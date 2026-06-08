import { formatSeoulDateTime } from "@/lib/utils";

export function sanitizeDownloadFileName(title: string) {
  return (
    title
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "post"
  );
}

export function buildPostMarkdownDocument({
  title,
  content,
  authorName,
  createdAt,
  postUrl,
}: {
  title: string;
  content: string;
  authorName: string;
  createdAt: Date;
  postUrl: string;
}) {
  const createdAtText = formatSeoulDateTime(createdAt);

  return `# ${title}

- 작성자: ${authorName}
- 작성일: ${createdAtText}
- 작성 링크: ${postUrl}

---

${content}
`;
}

export function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadPostMarkdownFile(params: {
  title: string;
  content: string;
  authorName: string;
  createdAt: Date;
  postUrl: string;
}) {
  const markdown = buildPostMarkdownDocument(params);
  const blob = new Blob([markdown], {
    type: "text/markdown;charset=utf-8",
  });

  triggerBlobDownload(blob, `${sanitizeDownloadFileName(params.title)}.md`);
}

export type PostAttachmentInput = {
  fileName: string;
  fileUrl: string;
  fileSize?: number | null;
};

export function mapPostAttachments(
  attachments: Array<{
    id: bigint;
    fileName: string;
    fileUrl: string;
    fileSize: number | null;
  }>,
) {
  return attachments.map((attachment) => ({
    id: Number(attachment.id),
    file_name: attachment.fileName,
    file_url: attachment.fileUrl,
    file_size: attachment.fileSize,
  }));
}

export function formatAttachmentFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) {
    return "";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

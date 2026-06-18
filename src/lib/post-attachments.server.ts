import { type PostAttachmentInput } from "@/lib/post-attachments";
import { prisma } from "@/lib/prisma";

export async function syncPostAttachments(
  postId: number | bigint,
  attachments: PostAttachmentInput[],
) {
  const normalizedPostId = BigInt(postId);

  await prisma.postAttachment.deleteMany({
    where: { postId: normalizedPostId },
  });

  if (attachments.length === 0) {
    return;
  }

  await prisma.postAttachment.createMany({
    data: attachments.map((attachment, index) => ({
      postId: normalizedPostId,
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl,
      fileSize: attachment.fileSize ?? null,
      sortOrder: index,
    })),
  });
}

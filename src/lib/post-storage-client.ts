export type PostMediaUploadKind =
  | "content"
  | "attachment"
  | "thumbnail"
  | "profile"
  | "chat";

export type UploadedPostMedia = {
  storagePath: string;
  signedUrl: string;
};

export async function uploadPostMedia(file: File, kind: PostMediaUploadKind) {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("kind", kind);

  const response = await fetch("/api/storage/post-media", {
    method: "POST",
    body: formData,
  });
  const payload = (await response.json().catch(() => null)) as
    | (Partial<UploadedPostMedia> & { message?: string })
    | null;

  if (!response.ok || !payload?.storagePath || !payload?.signedUrl) {
    throw new Error(payload?.message ?? "파일 업로드 중 오류가 발생했습니다.");
  }

  return {
    storagePath: payload.storagePath,
    signedUrl: payload.signedUrl,
  };
}

export async function removePostMedia(path?: string | null) {
  if (!path) {
    return;
  }

  await fetch("/api/storage/post-media", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paths: [path] }),
  });
}

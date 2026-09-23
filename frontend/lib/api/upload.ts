import { ApiError } from "./users";

export interface PresignedPost {
  url: string;
  fields: Record<string, string>;
}

// XHR rather than fetch, which reports no upload progress.
export function uploadFile(post: PresignedPost, file: File, onProgress: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(post.fields)) form.append(key, value);
    // S3 ignores every field after the file.
    form.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new ApiError(xhr.status, `Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new ApiError(0, "Upload failed (network)"));
    xhr.open("POST", post.url);
    xhr.send(form);
  });
}

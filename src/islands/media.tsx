import { useRef } from "react";

/**
 * Shared media-attachment helpers for the interactive islands.
 *
 * Backend: `POST /api/attachments` uploads a file on behalf of the signed-in
 * user (auth required) and returns its URL + kind; `GET /api/attachments/:name`
 * streams it back. Messages and comments then reference the returned URL via
 * an `attachment` field.
 */

export type AttachmentKind = "image" | "video" | "audio" | "file";

export type AttachmentMeta = {
  url: string;
  mimeType: string;
  kind: AttachmentKind;
  size: number;
};

/** Signature that a comment / message DTO carries when it has media. */
export type { AttachmentMeta as ApiAttachment };

/**
 * Upload a local file as a message / comment attachment.
 * Throws `Error` with a stable `.code` on auth / size / network failure.
 */
export async function uploadAttachment(file: File): Promise<AttachmentMeta> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch("/api/attachments", {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json" },
    body,
  });
  if (response.status === 401) {
    const err = new Error("unauthorized") as Error & { code?: string };
    err.code = "unauthorized";
    throw err;
  }
  if (response.status === 413) {
    const err = new Error("too_large") as Error & { code?: string };
    err.code = "too_large";
    throw err;
  }
  if (!response.ok) {
    const err = new Error("upload_failed") as Error & { code?: string };
    err.code = "upload_failed";
    throw err;
  }
  return (await response.json()) as AttachmentMeta;
}

/** Render an attached media by its kind. `className` is merged onto the wrapper. */
export function MediaEmbed({
  attachment,
  className,
  title = "附件",
}: {
  attachment?: AttachmentMeta | null;
  className?: string;
  title?: string;
}) {
  if (!attachment?.url) return null;
  const { url, kind } = attachment;
  const cls = className ? `att__embed ${className}` : "att__embed";
  switch (kind) {
    case "video":
      return (
        <div className={cls}>
          <video className="att__media" controls playsInline preload="metadata" src={url} />
        </div>
      );
    case "image":
      return (
        <div className={cls}>
          <img className="att__media" src={url} alt={title} loading="lazy" decoding="async" />
        </div>
      );
    case "audio":
      return (
        <div className={cls}>
          <audio className="att__audio" controls preload="metadata" src={url} />
        </div>
      );
    default:
      return (
        <div className={cls}>
          <a className="att__file" href={url} target="_blank" rel="noopener noreferrer">
            查看附件
          </a>
        </div>
      );
  }
}

/**
 * Composer file picker. Reports the chosen file via `onFileChange`; the owner
 * owns uploading (so it can set its own busy / notice state). `onRemove` clears
 * the current selection. Renders a status chip once `attachment` is set.
 */
export function AttachmentPicker({
  attachment,
  busy,
  onFileChange,
  onRemove,
}: {
  attachment: AttachmentMeta | null;
  busy: boolean;
  onFileChange: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const clearInput = () => {
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="att__picker" aria-busy={busy}>
      <input
        ref={inputRef}
        className="att__file-input"
        type="file"
        accept="image/*,video/*,audio/*,.jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.webm,.m4a,.mp3,.mp4,.mpeg"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          clearInput();
          onFileChange(file);
        }}
      />
      {attachment ? (
        <span className="att__chip">
          <span className="att__chip-label">
            {attachment.kind === "video"
              ? "视频"
              : attachment.kind === "audio"
                ? "音频"
                : attachment.kind === "image"
                  ? "图片"
                  : "文件"}
          </span>
          <button
            type="button"
            className="att__chip-remove"
            onClick={() => {
              clearInput();
              onRemove();
            }}
          >
            移除 ✕
          </button>
        </span>
      ) : null}
      {busy ? <span className="att__busy">上传中…</span> : null}
    </div>
  );
}
import { FileText } from "lucide-react";

const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp", "svg"];

// Renders a homework/document attachment inline where the browser can actually do that
// (images, PDFs) instead of just a bare "click to download" link. Word/Excel/PowerPoint have
// no reliable dependency-free inline renderer, so those fall back to a clearer file card —
// still better than a plain filename link, just not literally rendered on the page.
export function AttachmentPreview({ url }: { url: string }) {
  const name = url.split("/").pop() ?? "attachment";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";

  if (IMAGE_EXT.includes(ext)) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block">
        <img
          src={url}
          alt={name}
          className="max-h-48 w-full rounded-md border object-contain bg-muted/30"
        />
      </a>
    );
  }

  if (ext === "pdf") {
    return (
      <div className="rounded-md border overflow-hidden">
        <iframe src={url} title={name} className="w-full h-64 bg-white" />
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-primary hover:underline border-t bg-muted/30 truncate"
        >
          <FileText className="h-3.5 w-3.5 shrink-0" /> Open {name} in a new tab
        </a>
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-md border p-2 text-sm hover:bg-muted/50"
    >
      <FileText className="h-5 w-5 text-primary shrink-0" />
      <span className="truncate">{name}</span>
    </a>
  );
}

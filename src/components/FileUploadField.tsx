import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { AttachmentPreview } from "@/components/AttachmentPreview";

// Generic (non-image) file attachment field — homework worksheets, etc. Unlike
// ImageUploadField this shows a filename link instead of an <img> preview in its own row,
// since the uploaded file is just as likely to be a PDF or Word doc as a picture — the actual
// inline preview (image/PDF) renders separately via AttachmentPreview below.
export function FileUploadField({
  value,
  onChange,
}: {
  value?: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await api.uploads.upload(file);
      onChange(url);
      toast.success("Attachment uploaded");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {value ? (
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="flex-1 flex items-center gap-1.5 text-sm text-primary hover:underline truncate"
          >
            <Paperclip className="h-4 w-4 shrink-0" />
            {value.split("/").pop()}
          </a>
        ) : (
          <p className="flex-1 text-sm text-muted-foreground">No file attached</p>
        )}
        {value && (
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange("")} title="Remove attachment">
            <X className="h-4 w-4" />
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          title="Attach a file"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        </Button>
      </div>
      {value && <AttachmentPreview url={value} />}
    </div>
  );
}

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function ImageUploadField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await api.uploads.upload(file);
      onChange(url);
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-2">
      {value && (
        <img src={value} alt="" className="h-10 w-10 rounded-lg object-cover border shrink-0" />
      )}
      <Input placeholder={placeholder ?? "https://…"} value={value} onChange={(e) => onChange(e.target.value)} className="flex-1" />
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      <Button type="button" variant="outline" size="icon" disabled={uploading} onClick={() => inputRef.current?.click()} title="Upload from device">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
      </Button>
    </div>
  );
}

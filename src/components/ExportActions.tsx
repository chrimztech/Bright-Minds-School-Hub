import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";

// Shared "Download Excel (CSV)" + "Print" toolbar for list views. Marked no-print so the
// buttons themselves never show up in the printed output — only the table/report below them.
export function ExportActions({ onDownload }: { onDownload: () => void }) {
  return (
    <div className="no-print flex gap-2">
      <Button variant="outline" size="sm" onClick={onDownload}>
        <Download className="h-4 w-4 mr-1" /> Download Excel (CSV)
      </Button>
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="h-4 w-4 mr-1" /> Print
      </Button>
    </div>
  );
}

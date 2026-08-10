import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";

export function useSchool() {
  return useQuery({
    queryKey: ["school-settings-print"],
    queryFn: () => api.settings.get(),
    staleTime: 5 * 60_000,
  });
}

export function PrintOverlay({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm overflow-auto" onClick={onClose}>
      <div className="no-print sticky top-0 z-10 flex justify-end gap-2 p-4">
        <Button onClick={(e) => { e.stopPropagation(); window.print(); }}>
          <Printer className="h-4 w-4 mr-2" /> Print / Save PDF
        </Button>
        <Button variant="secondary" onClick={onClose}><X className="h-4 w-4 mr-2" /> Close</Button>
      </div>
      <div className="mx-auto my-8 max-w-[820px] bg-white text-black shadow-2xl print-area" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function DocHeader({ school, title }: { school: any; title: string }) {
  return (
    <div className="flex items-start justify-between border-b-2 border-black pb-5 mb-6">
      <div className="flex items-start gap-4">
        {school?.logoUrl ? (
          <img src={school.logoUrl} alt="" className="h-16 w-16 object-contain" />
        ) : (
          <div className="h-16 w-16 rounded-full bg-black text-white flex items-center justify-center font-display text-2xl">
            {(school?.name ?? "S").charAt(0)}
          </div>
        )}
        <div>
          <h1 className="font-display text-3xl leading-tight">{school?.name ?? "Your School"}</h1>
          {school?.motto && <p className="italic text-sm text-gray-600">"{school.motto}"</p>}
          <p className="text-xs text-gray-600 mt-1">
            {[school?.address, school?.phone, school?.email].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="uppercase tracking-widest text-[10px] text-gray-500">Document</p>
        <p className="font-display text-2xl">{title}</p>
      </div>
    </div>
  );
}

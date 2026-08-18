import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ImageUploadField } from "@/components/ImageUploadField";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings" }] }),
  component: Settings,
});

function Settings() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["school"], queryFn: () => api.settings.get() });
  const [f, setF] = useState<any>({});
  useEffect(() => { if (data) setF(data); }, [data]);
  const save = useMutation({
    mutationFn: async () => api.settings.update({
      name: f.name, motto: f.motto, address: f.address, phone: f.phone, email: f.email,
      website: f.website, currency: f.currency || "ZMW", logoUrl: f.logoUrl,
      city: f.city, province: f.province, country: f.country || "Zambia",
      postalCode: f.postalCode, poBox: f.poBox, district: f.district, plotNumber: f.plotNumber,
      latitude: f.latitude === "" ? undefined : Number(f.latitude) || undefined,
      longitude: f.longitude === "" ? undefined : Number(f.longitude) || undefined,
      mapUrl: f.mapUrl, establishedYear: f.establishedYear ? Number(f.establishedYear) : undefined,
      registrationNo: f.registrationNo, tpin: f.tpin,
      headTeacher: f.headTeacher, headTeacherSignatureUrl: f.headTeacherSignatureUrl, deputyHead: f.deputyHead,
    }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["school"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const mapSrc = f.latitude && f.longitude
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${Number(f.longitude)-0.01}%2C${Number(f.latitude)-0.01}%2C${Number(f.longitude)+0.01}%2C${Number(f.latitude)+0.01}&layer=mapnik&marker=${f.latitude}%2C${f.longitude}`
    : null;
  return (
    <>
      <PageHeader title="School settings" />
      <div className="p-6 max-w-3xl">
        <Card><CardContent className="p-6 space-y-3">
          <div><Label>School name</Label><Input value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><Label>Motto</Label><Input value={f.motto ?? ""} onChange={(e) => setF({ ...f, motto: e.target.value })} /></div>
          <div><Label>Logo</Label><ImageUploadField value={f.logoUrl ?? ""} onChange={(url) => setF({ ...f, logoUrl: url })} placeholder="https://…/logo.png" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Head teacher</Label><Input value={f.headTeacher ?? ""} onChange={(e) => setF({ ...f, headTeacher: e.target.value })} /></div>
            <div><Label>Deputy head</Label><Input value={f.deputyHead ?? ""} onChange={(e) => setF({ ...f, deputyHead: e.target.value })} /></div>
            <div><Label>Established</Label><Input type="number" value={f.establishedYear ?? ""} onChange={(e) => setF({ ...f, establishedYear: e.target.value })} /></div>
          </div>
          <div>
            <Label>Head teacher signature</Label>
            <ImageUploadField value={f.headTeacherSignatureUrl ?? ""} onChange={(url) => setF({ ...f, headTeacherSignatureUrl: url })} placeholder="https://… (image of their signature)" />
            <p className="text-xs text-muted-foreground mt-1">Stamped on report cards alongside the class teacher's signature.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Registration No.</Label><Input value={f.registrationNo ?? ""} onChange={(e) => setF({ ...f, registrationNo: e.target.value })} /></div>
            <div><Label>TPIN</Label><Input value={f.tpin ?? ""} onChange={(e) => setF({ ...f, tpin: e.target.value })} /></div>
          </div>
          <div className="border-t pt-3 mt-2">
            <p className="text-sm font-medium mb-2">Location</p>
            <div><Label>Street / Address</Label><Input value={f.address ?? ""} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div><Label>Plot number</Label><Input value={f.plotNumber ?? ""} onChange={(e) => setF({ ...f, plotNumber: e.target.value })} /></div>
              <div><Label>P.O. Box</Label><Input value={f.poBox ?? ""} onChange={(e) => setF({ ...f, poBox: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-2">
              <div><Label>City / Town</Label><Input value={f.city ?? ""} onChange={(e) => setF({ ...f, city: e.target.value })} placeholder="Lusaka" /></div>
              <div><Label>District</Label><Input value={f.district ?? ""} onChange={(e) => setF({ ...f, district: e.target.value })} /></div>
              <div><Label>Province</Label><Input value={f.province ?? ""} onChange={(e) => setF({ ...f, province: e.target.value })} placeholder="Lusaka Province" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-2">
              <div><Label>Country</Label><Input value={f.country ?? "Zambia"} onChange={(e) => setF({ ...f, country: e.target.value })} /></div>
              <div><Label>Postal code</Label><Input value={f.postalCode ?? ""} onChange={(e) => setF({ ...f, postalCode: e.target.value })} /></div>
              <div></div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-2">
              <div><Label>Latitude</Label><Input type="number" step="0.000001" value={f.latitude ?? ""} onChange={(e) => setF({ ...f, latitude: e.target.value })} placeholder="-15.387526" /></div>
              <div><Label>Longitude</Label><Input type="number" step="0.000001" value={f.longitude ?? ""} onChange={(e) => setF({ ...f, longitude: e.target.value })} placeholder="28.322817" /></div>
              <div><Label>Map URL</Label><Input value={f.mapUrl ?? ""} onChange={(e) => setF({ ...f, mapUrl: e.target.value })} placeholder="https://maps.google.com/?q=..." /></div>
            </div>
            {mapSrc && (
              <div className="mt-3">
                <iframe title="School map" src={mapSrc} className="w-full h-64 rounded border" />
                <a href={f.mapUrl || `https://www.openstreetmap.org/?mlat=${f.latitude}&mlon=${f.longitude}#map=17/${f.latitude}/${f.longitude}`} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Open in maps</a>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Phone</Label><Input value={f.phone ?? ""} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={f.email ?? ""} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Website</Label><Input value={f.website ?? ""} onChange={(e) => setF({ ...f, website: e.target.value })} /></div>
            <div><Label>Currency</Label><Input value={f.currency ?? "ZMW"} onChange={(e) => setF({ ...f, currency: e.target.value })} placeholder="ZMW" /></div>
          </div>
          <Button onClick={() => save.mutate()}>Save changes</Button>
        </CardContent></Card>
      </div>
    </>
  );
}
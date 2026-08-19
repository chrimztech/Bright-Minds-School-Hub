import { PrintOverlay, DocHeader, useSchool } from "@/components/PrintableDoc";
import { money } from "@/lib/format";
import type { Payment } from "@/lib/api";

// Shared by the admin Fees page and the parent portal so both print the exact same
// receipt — they used to be two near-identical components that could drift apart.
export function ReceiptPrint({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const { data: school } = useSchool();
  const inv = payment.invoice;
  const balance = inv ? Number(inv.total) - Number(inv.paid) : null;
  return (
    <PrintOverlay onClose={onClose}>
      <div className="p-10 font-sans">
        <DocHeader school={{ ...school, logoUrl: school?.logoUrl ?? "/logo.png" }} title="Receipt" />
        <div className="grid grid-cols-2 gap-8 text-sm mb-8">
          <div>
            <p className="uppercase text-[10px] tracking-widest text-gray-500 mb-1">Received from</p>
            <p className="font-semibold text-lg">{payment.pupil?.fullName}</p>
            <p className="text-gray-600">Adm #: {payment.pupil?.admissionNo}</p>
          </div>
          <div className="text-right">
            <p><span className="text-gray-500">Receipt no:</span> <span className="font-mono">{payment.receiptNo}</span></p>
            <p><span className="text-gray-500">Date:</span> {payment.paidOn}</p>
            <p><span className="text-gray-500">Method:</span> {payment.method.replace("_", " ")}</p>
            {payment.reference && <p><span className="text-gray-500">Reference:</span> {payment.reference}</p>}
          </div>
        </div>
        <table className="w-full text-sm border-collapse mb-8">
          <thead><tr className="border-b-2 border-black text-left">
            <th className="py-2">Description</th>
            <th className="py-2 text-right">Amount</th>
          </tr></thead>
          <tbody>
            <tr className="border-b border-gray-200">
              <td className="py-3">{inv ? `Payment towards invoice ${inv.invoiceNo}${inv.description ? " — " + inv.description : ""}` : "School fee payment"}</td>
              <td className="py-3 text-right">{money(payment.amount)}</td>
            </tr>
          </tbody>
          {inv && (
            <tfoot>
              <tr><td className="pt-4 text-right text-gray-500">Invoice total</td><td className="pt-4 text-right">{money(inv.total)}</td></tr>
              <tr><td className="text-right text-gray-500">Total paid to date</td><td className="text-right">{money(inv.paid)}</td></tr>
              <tr className="text-lg font-bold"><td className="pt-2 text-right">Balance remaining</td><td className="pt-2 text-right">{money(balance ?? 0)}</td></tr>
            </tfoot>
          )}
        </table>
        <div className="border-t border-gray-300 pt-6 text-xs text-gray-500 flex justify-between">
          <p>Thank you for partnering with us in your child's education.</p>
          <p>Generated {new Date().toLocaleString()}</p>
        </div>
      </div>
    </PrintOverlay>
  );
}

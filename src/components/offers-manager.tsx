"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useI18n } from "./i18n";
import { formatMoney } from "@/lib/currency";
import { createOffer, deleteOffer, updateProduct } from "@/app/(app)/settings/actions";
import type { ProductKind } from "@/lib/types";

interface Offer { id: string; code: string; name: string }
interface Product { id: string; name: string; offer_id: string | null; kind: ProductKind; price: number; currency: string; gateway: string | null; gateway_product_id: string | null }

export function OffersManager({ offers, products }: { offers: Offer[]; products: Product[] }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const run = (fn: () => Promise<{ ok: boolean; message: string }>) => start(async () => {
    const r = await fn();
    setErr(r.ok ? "" : r.message);
    router.refresh();
  });
  const kinds: ProductKind[] = ["main", "bump", "upsell1", "upsell2", "downsell"];
  const sorted = [...products].sort((a, b) => Number(!!a.offer_id) - Number(!!b.offer_id));

  return (
    <>
      <div className="card flex flex-col gap-3 p-4">
        <h2 className="font-medium">{t.offersUi.offers}</h2>
        {offers.length === 0 && <p className="text-sm text-muted">{t.offersUi.noOffers}</p>}
        <div className="flex flex-wrap gap-2">
          {offers.map((o) => (
            <span key={o.id} className="flex items-center gap-2 rounded-lg bg-soft px-3 py-1.5 text-sm">
              <code className="font-semibold">{o.code}</code> {o.name}
              <button className="text-muted hover:text-bad" title={t.offersUi.delete} disabled={pending} onClick={() => run(() => deleteOffer(o.id))}>
                <Trash2 className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await createOffer(code, name); if (r.ok) { setCode(""); setName(""); } return r; }); }}>
          <label className="flex flex-col gap-1 text-xs text-muted">{t.offersUi.code}
            <input className="input w-32 uppercase" maxLength={4} value={code} onChange={(e) => setCode(e.target.value)} placeholder="AT" required />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">{t.offersUi.name}
            <input className="input w-56" value={name} onChange={(e) => setName(e.target.value)} placeholder="Atlas" />
          </label>
          <button className="btn-primary" disabled={pending}>{t.offersUi.add}</button>
        </form>
        {err && <p className="text-sm text-bad">{err}</p>}
      </div>

      <div id="productos" className="card flex flex-col gap-3 p-4">
        <h2 className="font-medium">{t.offersUi.products}</h2>
        <p className="text-xs text-muted">{t.offersUi.productsHelp}</p>
        {products.length === 0 ? <p className="text-sm text-muted">{t.offersUi.noProducts}</p> : (
          <div className="overflow-x-auto">
            <table className="tnum w-full min-w-[760px] text-sm">
              <thead className="border-b border-line text-left text-xs text-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">{t.sales.product}</th>
                  <th className="py-2 pr-3 font-medium">{t.offersUi.gateway}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t.offersUi.price}</th>
                  <th className="py-2 pr-3 font-medium">{t.offersUi.offer}</th>
                  <th className="py-2 pr-3 font-medium">{t.offersUi.kind}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => (
                  <tr key={p.id} className={`border-b border-line ${p.offer_id ? "" : "bg-warn-soft"}`}>
                    <td className="py-2 pr-3">{p.name}<div className="text-xs text-muted">{t.offersUi.externalId}: {p.gateway_product_id ?? "—"}</div></td>
                    <td className="py-2 pr-3 text-xs">{p.gateway ?? "—"}</td>
                    <td className="py-2 pr-3 text-right">{formatMoney(Number(p.price), p.currency, lang)}</td>
                    <td className="py-2 pr-3">
                      <select className="input" value={p.offer_id ?? ""} disabled={pending} onChange={(e) => run(() => updateProduct(p.id, e.target.value || null, p.kind))}>
                        <option value="">{t.offersUi.unassigned}</option>
                        {offers.map((o) => <option key={o.id} value={o.id}>{o.code} · {o.name}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <select className="input" value={p.kind} disabled={pending} onChange={(e) => run(() => updateProduct(p.id, p.offer_id, e.target.value as ProductKind))}>
                        {kinds.map((k) => <option key={k} value={k}>{t.sales.kind[k]}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

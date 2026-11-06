import { getDict } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { serviceConfigured } from "@/lib/env";
import { admin } from "@/lib/supabase/admin";
import { SettingsForm } from "@/components/settings-form";
import { OffersManager } from "@/components/offers-manager";
import { PageHeader } from "@/components/ui";

export default async function SettingsPage() {
  const [{ t }, settings] = await Promise.all([getDict(), getSettings()]);
  const [offers, products] = serviceConfigured
    ? await Promise.all([
        admin().from("offers").select("id,code,name").order("code"),
        admin().from("products").select("id,name,offer_id,kind,price,currency,gateway,gateway_product_id").order("created_at", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }];
  return (
    <>
      <PageHeader title={t.settings.title} />
      <SettingsForm initial={settings} />
      {serviceConfigured && <OffersManager offers={offers.data ?? []} products={products.data ?? []} />}
    </>
  );
}

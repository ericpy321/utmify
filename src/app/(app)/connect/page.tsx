import { headers } from "next/headers";
import { getDict } from "@/lib/i18n/server";
import { CopyBlock } from "@/components/copy-button";
import { PageHeader, StatusPill } from "@/components/ui";

// Parámetros de URL por plataforma (con IDs). Las macros se vuelven a verificar en la etapa de integraciones.
const META_PARAMS = "utm_source=fb&utm_campaign={{campaign.id}}&utm_medium={{adset.id}}&utm_content={{ad.id}}&utm_term={{placement}}";
const TIKTOK_PARAMS = "utm_source=tiktok&utm_campaign=__CAMPAIGN_ID__&utm_medium=__AID__&utm_content=__CID__";

export default async function ConnectPage() {
  const { t } = await getDict();
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;

  const platforms = [
    { name: "Meta Ads (Facebook / Instagram)", params: META_PARAMS },
    { name: "TikTok Ads", params: TIKTOK_PARAMS },
  ];

  return (
    <>
      <PageHeader title={t.connect.title} />

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">{t.connect.adPlatforms}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {platforms.map((p) => (
            <div key={p.name} className="card flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{p.name}</span>
                <StatusPill status="paused" label={t.connect.notConnected} />
              </div>
              <p className="text-xs text-muted">{t.connect.pendingLast}</p>
              <div>
                <div className="mb-1 text-sm font-medium">{t.connect.urlParams}</div>
                <CopyBlock text={p.params} />
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted">{t.connect.paramsHelp} {t.connect.verifyMacros}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">{t.connect.gateways}</h2>
        <div className="card flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">{t.connect.webhookUrl}</span>
            <StatusPill status="paused" label={t.connect.notConnected} />
          </div>
          <CopyBlock text={`${origin}/api/webhooks/<gateway>`} />
          <p className="text-xs text-muted">{t.connect.webhookPending} {t.connect.pendingLast}</p>
        </div>
        <div className="card flex flex-col gap-2 p-4">
          <span className="font-medium">{t.connect.trackingScript}</span>
          <p className="text-sm text-muted">{t.connect.scriptPending}</p>
        </div>
      </section>
    </>
  );
}

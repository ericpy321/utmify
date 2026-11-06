import Link from "next/link";
import { headers } from "next/headers";
import { getDict } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { gatewaySecrets, GATEWAYS, googleApiVersion, googleConfigured, googleLoginCustomerId, metaApiVersion, metaToken, serviceConfigured, siteUrl, syncSecret, tiktokAppId, tiktokSecret } from "@/lib/env";
import { admin } from "@/lib/supabase/admin";
import { tiktokConnected } from "@/lib/sync/tiktok";
import { googleConnected } from "@/lib/sync/google";
import { localeFor } from "@/lib/currency";
import { CopyBlock } from "@/components/copy-button";
import { FindAccountsButton, ReprocessButton, SyncButton, TrackToggle } from "@/components/connect-controls";
import { PageHeader, StatusPill } from "@/components/ui";

// Parámetros de URL con IDs (los nombres cambian y se repiten; el ID no).
const META_PARAMS = "utm_source=fb&utm_campaign={{campaign.id}}&utm_medium={{adset.id}}&utm_content={{ad.id}}&utm_term={{placement}}";
const TIKTOK_PARAMS = "utm_source=tiktok&utm_campaign=__CAMPAIGN_ID__&utm_medium=__AID__&utm_content=__CID__";
// Google Ads (ValueTrack): {campaignid}, {adgroupid} y {creative} = id del anuncio.
const GOOGLE_PARAMS = "utm_source=google&utm_campaign={campaignid}&utm_medium={adgroupid}&utm_content={creative}&utm_term={keyword}";
// Los gateways que usas aparecen primero; el resto queda plegado.
const MAIN_GATEWAYS = ["hotmart", "stripe", "whop"];

const SECRET_VAR: Record<string, string> = {
  whop: "WHOP_WEBHOOK_SECRET", digistore24: "DIGISTORE24_IPN_PASSPHRASE", hotmart: "HOTMART_HOTTOK", kiwify: "KIWIFY_WEBHOOK_TOKEN",
  stripe: "STRIPE_WEBHOOK_SECRET", clickbank: "CLICKBANK_SECRET_KEY", generic: "WEBHOOK_SECRET",
};
const GATEWAY_NAME: Record<string, string> = {
  whop: "Whop", digistore24: "Digistore24", hotmart: "Hotmart", kiwify: "Kiwify", stripe: "Stripe", clickbank: "ClickBank", generic: "",
};

// Fuera del componente: el lint de React no permite Date.now() durante el render.
function sevenDaysAgo() {
  return new Date(Date.now() - 7 * 86_400_000).toISOString();
}

export default async function ConnectPage({ searchParams }: PageProps<"/connect">) {
  const [{ t, lang }, sp, settings] = await Promise.all([getDict(), searchParams, getSettings()]);
  const h = await headers();
  const origin = siteUrl(h.get("x-forwarded-host") ?? h.get("host"));
  const dt = new Intl.DateTimeFormat(localeFor(lang), { dateStyle: "short", timeStyle: "short", timeZone: settings.timezone });
  const when = (v: unknown) => (v ? dt.format(new Date(String(v))) : t.integ.never);
  const db = serviceConfigured ? admin() : null;

  const since = sevenDaysAgo();
  const [accRes, runsRes, evRes, ttOk, unassigned, gOk] = await Promise.all([
    db?.from("ad_accounts").select("*").order("platform").order("name"),
    db?.from("sync_runs").select("source,started_at,finished_at,ok,detail").order("started_at", { ascending: false }).limit(10),
    db?.from("webhook_events").select("gateway,received_at,error,signature_valid").gte("received_at", since).order("received_at", { ascending: false }).limit(2000),
    db ? tiktokConnected() : Promise.resolve(false),
    db?.from("products").select("id", { count: "exact", head: true }).is("offer_id", null),
    db ? googleConnected() : Promise.resolve(false),
  ]);
  const accounts = accRes?.data ?? [];
  const runs = runsRes?.data ?? [];
  const events = evRes?.data ?? [];
  const ttMsg = { ok: t.integ.ttOk, error: t.integ.ttError, estado_invalido: t.integ.ttState, sin_app: t.integ.ttNoApp }[String(sp.tiktok ?? "")];
  const gMsg = { ok: t.integ.gOk, error: t.integ.gError, estado_invalido: t.integ.gState, sin_app: t.integ.gNoApp }[String(sp.google ?? "")];

  const statsFor = (g: string) => {
    const list = events.filter((e) => e.gateway === g);
    return { count: list.length, errors: list.filter((e) => e.error).length, last: list[0]?.received_at, lastError: list.find((e) => e.error)?.error };
  };

  const accountTable = (platform: "meta" | "tiktok" | "google") => {
    const list = accounts.filter((a) => a.platform === platform);
    if (!list.length) return <p className="text-sm text-muted">{t.integ.noAccounts}</p>;
    return (
      <div className="flex flex-col divide-y divide-line">
        {list.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <div>
              <div className="font-medium">{a.name}</div>
              <div className="text-xs text-muted">{a.id} · {a.currency} · {a.timezone} · {t.integ.lastSync}: {when(a.last_synced_at)}</div>
            </div>
            <TrackToggle id={a.id} tracked={a.tracked} />
          </div>
        ))}
      </div>
    );
  };

  const gatewayCard = (g: (typeof GATEWAYS)[number]) => {
    const info = { name: GATEWAY_NAME[g] || t.integ.genericName, secretVar: SECRET_VAR[g], where: t.integ.where[g] };
    const st = statsFor(g);
    const hasSecret = Boolean(gatewaySecrets[g]);
    return (
      <div key={g} className="card flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between">
          <span className="font-medium">{info.name}</span>
          <StatusPill status={st.count ? "active" : "paused"} label={st.count ? t.integ.connected : t.connect.notConnected} />
        </div>
        <div className="text-sm font-medium">{t.connect.webhookUrl}</div>
        <CopyBlock text={`${origin}/api/webhooks/${g}${g === "generic" ? "?key=TU_WEBHOOK_SECRET" : ""}`} />
        {info.where && <p className="text-xs text-muted">{info.where}</p>}
        {g === "generic" && <p className="text-xs text-muted">{t.integ.genericHelp}</p>}
        <div className="tnum flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span>{t.integ.secret} <code>{info.secretVar}</code>: <b className={hasSecret ? "text-good" : "text-bad"}>{hasSecret ? t.integ.configured : t.integ.notConfigured}</b></span>
          <span>{t.integ.lastEvent}: {when(st.last)}</span>
          <span>{t.integ.events7d}: {st.count}</span>
          {st.errors > 0 && <span className="text-bad">{t.integ.withError}: {st.errors} ({st.lastError})</span>}
        </div>
      </div>
    );
  };

  return (
    <>
      <PageHeader title={t.connect.title} />
      {ttMsg && <div className={`card p-3 text-sm ${sp.tiktok === "ok" ? "text-good" : "text-bad"}`}>{ttMsg}</div>}
      {gMsg && <div className={`card p-3 text-sm ${sp.google === "ok" ? "text-good" : "text-bad"}`}>{gMsg}</div>}

      {/* Plataformas de anuncios */}
      <section className="flex flex-col gap-3">
        <h2 className="font-medium">{t.connect.adPlatforms}</h2>
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          <div className="card flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">{t.integ.meta}</span>
              <StatusPill status={metaToken ? "active" : "paused"} label={metaToken ? t.integ.connected : t.integ.missingToken} />
            </div>
            <p className="text-xs text-muted">{t.integ.envVar}: <code>META_ACCESS_TOKEN</code> · Marketing API {metaApiVersion}</p>
            {metaToken && <FindAccountsButton platform="meta" />}
            {accountTable("meta")}
            <div>
              <div className="mb-1 text-sm font-medium">{t.connect.urlParams}</div>
              <CopyBlock text={META_PARAMS} />
            </div>
          </div>

          <div className="card flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">{t.integ.tiktok}</span>
              <StatusPill status={ttOk ? "active" : "paused"} label={ttOk ? t.integ.connected : tiktokAppId ? t.connect.notConnected : t.integ.missingApp} />
            </div>
            <p className="text-xs text-muted">{t.integ.envVar}: <code>TIKTOK_APP_ID</code> · <code>TIKTOK_APP_SECRET</code> ({tiktokAppId && tiktokSecret ? t.integ.configured : t.integ.notConfigured})</p>
            <div>
              <div className="mb-1 text-sm font-medium">{t.integ.redirectUrl}</div>
              <CopyBlock text={`${origin}/api/tiktok/callback`} />
            </div>
            <div className="flex flex-wrap gap-2">
              {tiktokAppId && <a className="btn-primary" href="/api/tiktok/connect">{t.integ.connectTikTok}</a>}
              {ttOk && <FindAccountsButton platform="tiktok" />}
            </div>
            {accountTable("tiktok")}
            <div>
              <div className="mb-1 text-sm font-medium">{t.connect.urlParams}</div>
              <CopyBlock text={TIKTOK_PARAMS} />
            </div>
          </div>

          <div className="card flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">{t.integ.google}</span>
              <StatusPill status={gOk ? "active" : "paused"} label={gOk ? t.integ.connected : googleConfigured ? t.connect.notConnected : t.integ.missingApp} />
            </div>
            <p className="text-xs text-muted">{t.integ.envVar}: <code>GOOGLE_ADS_DEVELOPER_TOKEN</code> · <code>GOOGLE_ADS_CLIENT_ID</code> · <code>GOOGLE_ADS_CLIENT_SECRET</code> ({googleConfigured ? t.integ.configured : t.integ.notConfigured}) · <code>GOOGLE_ADS_LOGIN_CUSTOMER_ID</code> ({googleLoginCustomerId ? t.integ.configured : t.integ.notConfigured}) · API {googleApiVersion}</p>
            <div>
              <div className="mb-1 text-sm font-medium">{t.integ.googleRedirect}</div>
              <CopyBlock text={`${origin}/api/google/callback`} />
            </div>
            <div className="flex flex-wrap gap-2">
              {googleConfigured && <a className="btn-primary" href="/api/google/connect">{t.integ.connectGoogle}</a>}
              {gOk && <FindAccountsButton platform="google" />}
            </div>
            {accountTable("google")}
            <div>
              <div className="mb-1 text-sm font-medium">{t.connect.urlParams}</div>
              <CopyBlock text={GOOGLE_PARAMS} />
              <p className="mt-1 text-xs text-muted">{t.integ.googleParams}</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted">{t.connect.paramsHelp}</p>
      </section>

      {/* Gateways */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">{t.connect.gateways}</h2>
          <div className="flex flex-wrap items-center gap-3">
            {(unassigned?.count ?? 0) > 0 && <Link href="/settings#productos" className="text-sm text-warn underline">{t.integ.assignProducts} ({unassigned?.count})</Link>}
            <ReprocessButton />
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {GATEWAYS.filter((g) => MAIN_GATEWAYS.includes(g)).map(gatewayCard)}
        </div>
        <details className="group">
          <summary className="cursor-pointer text-sm text-muted hover:text-ink">{t.integ.otherGateways}</summary>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {GATEWAYS.filter((g) => !MAIN_GATEWAYS.includes(g)).map(gatewayCard)}
          </div>
        </details>
      </section>

      {/* Script de rastreo */}
      <section className="card flex flex-col gap-3 p-4">
        <h2 className="font-medium">{t.connect.trackingScript}</h2>
        <p className="text-sm text-muted">{t.integ.scriptHelp}</p>
        <CopyBlock text={`<script src="${origin}/t.js" async></script>`} />
        <div className="text-sm font-medium">{t.integ.whereToPaste}</div>
        <ul className="list-disc pl-5 text-sm text-muted">
          {t.integ.builders.map((b) => <li key={b}>{b}</li>)}
        </ul>
      </section>

      {/* Sincronización */}
      <section className="card flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">{t.integ.sync}</h2>
          <SyncButton />
        </div>
        <p className="text-xs text-muted">{t.integ.syncHelp} <code>SYNC_SECRET</code>: {syncSecret ? t.integ.configured : t.integ.notConfigured}</p>
        <div className="overflow-x-auto">
          <table className="tnum w-full min-w-[600px] text-sm">
            <thead className="border-b border-line text-left text-xs text-muted">
              <tr><th className="py-1 pr-3 font-medium">{t.integ.when}</th><th className="py-1 pr-3 font-medium">{t.integ.source}</th><th className="py-1 pr-3 font-medium">{t.integ.result}</th></tr>
            </thead>
            <tbody>
              {runs.map((r, i) => (
                <tr key={i} className="border-b border-line">
                  <td className="py-1 pr-3 whitespace-nowrap">{when(r.started_at)}</td>
                  <td className="py-1 pr-3">{r.source === "fx" ? t.integ.fx : r.source}</td>
                  <td className={`py-1 pr-3 text-xs ${r.ok ? "text-good" : r.ok === false ? "text-bad" : "text-muted"}`}>{r.ok ? t.integ.ok : r.ok === false ? `${t.integ.failed}: ${r.detail}` : "…"}</td>
                </tr>
              ))}
              {!runs.length && <tr><td colSpan={3} className="py-2 text-muted">{t.integ.never}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

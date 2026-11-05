import { getDict } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/settings-form";
import { PageHeader } from "@/components/ui";

export default async function SettingsPage() {
  const [{ t }, settings] = await Promise.all([getDict(), getSettings()]);
  return (
    <>
      <PageHeader title={t.settings.title} />
      <SettingsForm initial={settings} />
    </>
  );
}

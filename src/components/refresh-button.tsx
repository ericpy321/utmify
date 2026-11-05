"use client";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useI18n } from "./i18n";
import { refreshData } from "@/app/actions";

export function RefreshButton() {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button className="btn" disabled={pending} onClick={() => start(async () => { await refreshData(); router.refresh(); })}>
      <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} />
      {pending ? t.common.refreshing : t.common.refresh}
    </button>
  );
}

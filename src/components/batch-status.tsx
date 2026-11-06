"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "./i18n";
import { setBatchStatus } from "@/app/(app)/settings/actions";

export function BatchStatusButton({ offerId, code, status, createdAt }: { offerId: string; code: string; status: "testing" | "finished"; createdAt: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = status === "finished" ? "testing" : "finished";
  return (
    <button className="btn" disabled={pending} onClick={() => start(async () => { await setBatchStatus(offerId, code, next, createdAt); router.refresh(); })}>
      {status === "finished" ? t.offersUi.markTesting : t.offersUi.markFinished}
    </button>
  );
}

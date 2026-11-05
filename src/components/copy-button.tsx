"use client";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useI18n } from "./i18n";

export function CopyBlock({ text }: { text: string }) {
  const { t } = useI18n();
  const [ok, setOk] = useState(false);
  return (
    <div className="flex items-start gap-2">
      <code className="block flex-1 overflow-x-auto whitespace-pre rounded-lg bg-soft p-3 text-xs">{text}</code>
      <button
        className="btn shrink-0"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        }}
      >
        {ok ? <Check className="size-4 text-good" /> : <Copy className="size-4" />}
        {ok ? t.common.copied : t.common.copy}
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";

/** Copies the Telegram handoff text so a designer can paste it anywhere. */
export function CopyNote({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      // Older browsers or a blocked clipboard: fall back to a hidden textarea.
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        ta.remove();
      } catch {
        ok = false;
      }
    }
    setState(ok ? "copied" : "error");
    setTimeout(() => setState("idle"), 3000);
  }

  return (
    <div>
      <div className="btns" style={{ marginTop: 0, alignItems: "center" }}>
        <button type="button" className="b" onClick={copy}>Copy handoff note</button>
        <span role="status" aria-live="polite" className="small">
          {state === "copied" && "Copied. Paste it anywhere."}
          {state === "error" && "Could not copy. Open the preview and copy it by hand."}
        </span>
      </div>
      <details>
        <summary>Preview the note</summary>
        <pre className="tx">{text}</pre>
      </details>
    </div>
  );
}

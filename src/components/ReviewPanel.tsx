"use client";

import { useActionState } from "react";
import { reviewAction, type ReviewState } from "@/app/actions";

const INITIAL: ReviewState = { status: "idle", message: "" };

/**
 * Approve or drop an amber/red lead. Always shows what happened, including after the page refreshes
 * with the decision made, so the designer is never left guessing.
 */
export function ReviewPanel({ id, pending, tier, decided }: { id: string; pending: boolean; tier: "amber" | "red"; decided: string | null }) {
  const [state, formAction, working] = useActionState(reviewAction, INITIAL);
  const showForm = pending && state.status !== "ok";

  return (
    <section className="panel" style={{ borderColor: "var(--amber)", borderWidth: 2, margin: "var(--s-4) 0" }} aria-label="Designer decision">
      {showForm && (
        <>
          <h2>{tier === "red" ? "Check before this is dropped" : "Needs your decision"}</h2>
          <p className="small muted" style={{ margin: 0 }}>
            Approve sends it the way a green lead goes (HubSpot, consultation booking, Telegram). Drop closes it; the call stays in the list.
          </p>
          <form action={formAction} aria-busy={working}>
            <input type="hidden" name="id" value={id} />
            <div className="btns">
              <button className="b primary" name="decision" value="approve" disabled={working}>{working ? "Working…" : "Approve and hand off"}</button>
              <button className="b" name="decision" value="drop" disabled={working}>Drop lead</button>
            </div>
          </form>
        </>
      )}
      {state.message && (
        <p className={`banner ${state.status === "ok" ? "ok" : "err"}`} role={state.status === "ok" ? "status" : "alert"} style={{ marginBottom: 0 }}>
          {state.message}
        </p>
      )}
      {!pending && !state.message && <p style={{ margin: 0 }}><b>Decision recorded:</b> {decided ?? "closed"}.</p>}
    </section>
  );
}

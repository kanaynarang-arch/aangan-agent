"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { approveReview } from "@/lib/pipeline";
import { startCallback, type StartResult } from "@/lib/outbound";

export interface ReviewState {
  status: "idle" | "ok" | "error";
  message: string;
}

/** Designer decision on an amber or red lead in the verify queue. Always returns a message to show. */
export async function reviewAction(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id) || (decision !== "approve" && decision !== "drop")) {
    return { status: "error", message: "That request was not valid. Nothing was changed." };
  }
  try {
    let result: { ok: boolean; message: string };
    if (decision === "approve") {
      result = await approveReview(id);
    } else {
      const done = await query<{ id: string }>(
        "update calls set review_status = 'dropped', outcome = 'Dropped by designer' where id = $1 and review_status = 'pending' returning id",
        [id],
      );
      result = done.length
        ? { ok: true, message: "Dropped. The call stays in the list, marked as dropped." }
        : { ok: false, message: "This lead was already decided." };
    }
    revalidatePath("/");
    revalidatePath(`/calls/${id}`);
    revalidatePath("/pipeline");
    return { status: result.ok ? "ok" : "error", message: result.message };
  } catch {
    return { status: "error", message: "Something went wrong and nothing was changed. Please try again." };
  }
}

/** "Have Vani call back": starts the agent's callback for one lead. Always returns a message to show. */
export async function callbackAction(id: string): Promise<StartResult> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, message: "That request was not valid. Nothing was started." };
  try {
    const r = await startCallback(id);
    revalidatePath(`/calls/${id}`);
    return r;
  } catch {
    return { ok: false, message: "Something went wrong and nothing was started. Please try again." };
  }
}

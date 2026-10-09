"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { approveReview } from "@/lib/pipeline";

/** Designer decision on an amber or red lead in the verify queue. */
export async function reviewCall(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  if (decision === "approve") {
    await approveReview(id);
  } else if (decision === "drop") {
    await query("update calls set review_status = 'dropped', outcome = 'Dropped by designer' where id = $1 and review_status = 'pending'", [id]);
  }
  revalidatePath("/");
  revalidatePath(`/calls/${id}`);
  revalidatePath("/pipeline");
}

import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export async function writeAudit(input: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  meta?: Record<string, unknown> | null;
}) {
  try {
    await db().insert(auditLogs).values({
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      meta: input.meta ? JSON.stringify(input.meta) : null,
    });
  } catch (err) {
    console.error("[audit]", err);
  }
}

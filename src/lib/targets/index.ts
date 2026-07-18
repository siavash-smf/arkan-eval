import type { EvalTarget } from "../types";
import { createHttpChatTarget } from "./http-chat";
import { createFixtureTarget } from "./fixture";

export { createHttpChatTarget, createFixtureTarget };

export const TARGET_IDS = ["http-chat", "fixture"] as const;
export type TargetId = (typeof TARGET_IDS)[number];

export const TARGET_LABELS: Record<TargetId, string> = {
  "http-chat": "چت‌بات زنده (HTTP)",
  fixture: "پاسخ‌های ضبط‌شده",
};

export function resolveTarget(id: string): EvalTarget {
  switch (id) {
    case "http-chat":
      return createHttpChatTarget();
    case "fixture":
      return createFixtureTarget({});
    default:
      throw new Error(`هدف ناشناخته: ${id}`);
  }
}

import { ApiError, apiDownload, apiRequest } from "../../../lib/api/client";
import type { Translate } from "../../../lib/i18n";

export type AiChatResponse = {
  answer: string;
  modelUsed: string;
  dataSource?: string;
  conversationId: string;
  userMessage: AiMessage;
  assistantMessage: AiMessage;
};

export type AiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  modelUsed: string | null;
  dataSource: string | null;
  createdAt: string;
};

export type AiConversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type AiConversationList = {
  items: AiConversation[];
  hasMore: boolean;
};

export type AiConversationPage = {
  conversation: AiConversation;
  messages: AiMessage[];
  hasMore: boolean;
  nextBefore: number | null;
};

export function askAi(
  message: string,
  conversationId?: string,
): Promise<AiChatResponse> {
  return apiRequest<AiChatResponse>("ai/chat", {
    method: "POST",
    body: { message, ...(conversationId ? { conversationId } : {}) },
  });
}

export function listAiConversations(
  offset = 0,
  signal?: AbortSignal,
): Promise<AiConversationList> {
  return apiRequest<AiConversationList>(
    `ai/conversations?offset=${offset}&limit=50`,
    {
      signal,
    },
  );
}

export function getAiConversation(
  id: string,
  before?: number,
  signal?: AbortSignal,
): Promise<AiConversationPage> {
  const query = before ? `?before=${before}&limit=50` : "?limit=50";
  return apiRequest<AiConversationPage>(
    `ai/conversations/${encodeURIComponent(id)}${query}`,
    {
      signal,
    },
  );
}

export function deleteAiConversation(id: string): Promise<void> {
  return apiRequest<void>(`ai/conversations/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function isAiExportCommand(message: string): boolean {
  const request = message.trim();
  if (/^(?:bagaimana|gimana|cara|apakah|kenapa|mengapa)\b/i.test(request))
    return false;
  return /\b(?:export|ekspor|unduh|download)\b|\bbuat(?:kan)?\s+(?:file\s+)?csv\b/i.test(
    request,
  );
}

export async function exportAiCsv(
  message: string,
  conversationId?: string,
): Promise<{ conversationId: string | null; rowCount: number | null }> {
  const result = await apiDownload("ai/export", {
    method: "POST",
    body: { message, ...(conversationId ? { conversationId } : {}) },
  });
  const url = URL.createObjectURL(result.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download =
    result.filename?.replace(/[^a-zA-Z0-9._-]/g, "") || "hotel-export.csv";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { conversationId: result.conversationId, rowCount: result.rowCount };
}

export function aiErrorText(
  cause: unknown,
  t: Translate,
  fallback: string,
): string {
  if (!(cause instanceof ApiError)) return fallback;
  if (cause.status === 401) return t("sessionExpired");
  if (cause.status === 403) return t("forbidden");
  if (cause.status === 429) return t("rateLimited");
  if (cause.code === "AI_NOT_CONFIGURED") return t("notConfigured");
  if (cause.code === "AI_UNAVAILABLE") return t("unavailable");
  return cause.message || fallback;
}

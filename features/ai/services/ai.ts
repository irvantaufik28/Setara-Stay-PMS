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

export function exportAiCsv(message: string): Promise<Blob> {
  return apiDownload("ai/export", {
    method: "POST",
    body: { message },
  });
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

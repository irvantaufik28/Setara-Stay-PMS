"use client";
import "../styles/ai.css";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import { AiMessageContent } from "../components/AiMessageContent";
import { restoreSession } from "../../../lib/auth";
import { useTranslations } from "../../../lib/i18n";
import {
  aiErrorText,
  askAi,
  exportAiCsv,
  getAiConversation,
  listAiConversations,
  type AiConversation,
  type AiMessage,
} from "../services/ai";
import en from "../locales/en.json";
import id from "../locales/id.json";

function downloadCsv(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `hotel-export-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function AiAssistantPage() {
  const { t } = useTranslations({ en, id });
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [listHasMore, setListHasMore] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [entries, setEntries] = useState<AiMessage[]>([]);
  const [messagesHasMore, setMessagesHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [draft, setDraft] = useState("");
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [busy, setBusy] = useState<"chat" | "export" | null>(null);
  const [error, setError] = useState("");
  const [exportStatus, setExportStatus] = useState("");
  const selectionVersion = useRef(0);
  const skipNextScroll = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        if (!(await restoreSession()) || controller.signal.aborted) return;
        const list = await listAiConversations(0, controller.signal);
        if (controller.signal.aborted) return;
        setConversations(list.items);
        setListHasMore(list.hasMore);
        if (list.items[0]) {
          const page = await getAiConversation(
            list.items[0].id,
            undefined,
            controller.signal,
          );
          if (controller.signal.aborted) return;
          setSelectedId(page.conversation.id);
          setEntries(page.messages);
          setMessagesHasMore(page.hasMore);
          setNextBefore(page.nextBefore);
        }
      } catch {
        if (!controller.signal.aborted) setHistoryError(true);
      } finally {
        if (!controller.signal.aborted) setHistoryLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (skipNextScroll.current) {
      skipNextScroll.current = false;
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries, busy]);

  async function selectConversation(conversationId: string) {
    if (busy || historyLoading || selectedId === conversationId) return;
    const version = ++selectionVersion.current;
    setSelectedId(conversationId);
    setEntries([]);
    setHistoryLoading(true);
    setHistoryError(false);
    setError("");
    try {
      const page = await getAiConversation(conversationId);
      if (selectionVersion.current !== version) return;
      setEntries(page.messages);
      setMessagesHasMore(page.hasMore);
      setNextBefore(page.nextBefore);
    } catch {
      if (selectionVersion.current === version) setHistoryError(true);
    } finally {
      if (selectionVersion.current === version) setHistoryLoading(false);
    }
  }

  function newConversation() {
    if (busy) return;
    selectionVersion.current += 1;
    setSelectedId(null);
    setEntries([]);
    setMessagesHasMore(false);
    setNextBefore(null);
    setHistoryLoading(false);
    setHistoryError(false);
    setError("");
    setExportStatus("");
    inputRef.current?.focus();
  }

  async function loadOlderMessages() {
    if (!selectedId || !nextBefore || olderLoading) return;
    const version = selectionVersion.current;
    setOlderLoading(true);
    try {
      const page = await getAiConversation(selectedId, nextBefore);
      if (selectionVersion.current !== version) return;
      skipNextScroll.current = true;
      setEntries((current) => {
        const existing = new Set(current.map((entry) => entry.id));
        return [
          ...page.messages.filter((entry) => !existing.has(entry.id)),
          ...current,
        ];
      });
      setMessagesHasMore(page.hasMore);
      setNextBefore(page.nextBefore);
    } catch {
      setHistoryError(true);
    } finally {
      setOlderLoading(false);
    }
  }

  async function loadMoreConversations() {
    if (!listHasMore || listLoading) return;
    setListLoading(true);
    try {
      const list = await listAiConversations(conversations.length);
      setConversations((current) => {
        const existing = new Set(current.map((item) => item.id));
        return [
          ...current,
          ...list.items.filter((item) => !existing.has(item.id)),
        ];
      });
      setListHasMore(list.hasMore);
    } catch {
      setHistoryError(true);
    } finally {
      setListLoading(false);
    }
  }

  async function sendQuestion(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const message = draft.trim();
    if (!message || busy || historyLoading) return;
    setError("");
    setExportStatus("");
    setBusy("chat");
    setPendingQuestion(message);
    setDraft("");
    try {
      const result = await askAi(message, selectedId ?? undefined);
      setSelectedId(result.conversationId);
      setEntries((current) => [
        ...current,
        result.userMessage,
        result.assistantMessage,
      ]);
      void listAiConversations()
        .then((list) => {
          setConversations(list.items);
          setListHasMore(list.hasMore);
        })
        .catch(() => setHistoryError(true));
    } catch (cause) {
      setError(aiErrorText(cause, t, t("sendFailed")));
      setDraft(message);
    } finally {
      setPendingQuestion("");
      setBusy(null);
      inputRef.current?.focus();
    }
  }

  async function exportCsv() {
    const message = draft.trim();
    if (!message || busy) return;
    setError("");
    setExportStatus("");
    setBusy("export");
    try {
      downloadCsv(await exportAiCsv(message));
      setExportStatus(t("exportSuccess"));
    } catch (cause) {
      setError(aiErrorText(cause, t, t("exportFailed")));
    } finally {
      setBusy(null);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void sendQuestion();
    }
  }

  return (
    <AdminShell title={t("shell.title")} context={t("shell.context")}>
      <div className="ai-page">
        <header className="ai-page__header">
          <div>
            <h1>{t("title")}</h1>
            <p>{t("description")}</p>
          </div>
          <button
            type="button"
            className="ai-page__clear"
            disabled={busy !== null || historyLoading}
            onClick={newConversation}
          >
            {t("newChat")}
          </button>
        </header>

        <div className="ai-workspace">
          <aside className="ai-history" aria-label={t("historyTitle")}>
            <h2>{t("historyTitle")}</h2>
            {conversations.length === 0 && !historyLoading && !historyError && (
              <p className="ai-history__empty">{t("historyEmpty")}</p>
            )}
            <div className="ai-history__list">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className={
                    conversation.id === selectedId
                      ? "ai-history__item ai-history__item--active"
                      : "ai-history__item"
                  }
                  aria-current={
                    conversation.id === selectedId ? "true" : undefined
                  }
                  disabled={busy !== null || historyLoading}
                  onClick={() => void selectConversation(conversation.id)}
                >
                  {conversation.title}
                </button>
              ))}
            </div>
            {listHasMore && (
              <button
                type="button"
                className="ai-history__more"
                disabled={listLoading}
                onClick={() => void loadMoreConversations()}
              >
                {t("loadMore")}
              </button>
            )}
            {historyError && (
              <p className="ai-history__error" role="alert">
                {t("historyError")}
              </p>
            )}
          </aside>

          <div className="ai-chat-column">
            <section
              className="ai-conversation"
              aria-label={t("title")}
              aria-busy={historyLoading || busy === "chat"}
            >
              {historyLoading ? (
                <p className="ai-conversation__state" role="status">
                  {t("historyLoading")}
                </p>
              ) : historyError && entries.length === 0 ? (
                <p className="ai-conversation__state" role="alert">
                  {t("historyError")}
                </p>
              ) : entries.length === 0 && !pendingQuestion ? (
                <div className="ai-conversation__empty">
                  <h2>{t("emptyTitle")}</h2>
                  <p>{t("emptyDescription")}</p>
                </div>
              ) : (
                <div
                  className="ai-conversation__entries"
                  role="log"
                  aria-live="polite"
                >
                  {messagesHasMore && (
                    <button
                      type="button"
                      className="ai-conversation__older"
                      disabled={olderLoading}
                      onClick={() => void loadOlderMessages()}
                    >
                      {olderLoading ? t("historyLoading") : t("loadOlder")}
                    </button>
                  )}
                  {entries.map((entry) => (
                    <article
                      key={entry.id}
                      className={`ai-message ai-message--${entry.role}`}
                    >
                      <h2>
                        {entry.role === "user" ? t("you") : t("assistant")}
                      </h2>
                      {entry.role === "assistant" ? (
                        <AiMessageContent content={entry.content} />
                      ) : (
                        <p>{entry.content}</p>
                      )}
                      {entry.role === "assistant" && (
                        <div className="ai-message__meta">
                          {entry.dataSource && entry.dataSource !== "model" && (
                            <span>
                              {t("source", {
                                source: entry.dataSource.replaceAll("_", " "),
                              })}
                            </span>
                          )}
                          {entry.modelUsed && (
                            <span>
                              {t("model", { model: entry.modelUsed })}
                            </span>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                  {pendingQuestion && (
                    <article className="ai-message ai-message--user">
                      <h2>{t("you")}</h2>
                      <p>{pendingQuestion}</p>
                    </article>
                  )}
                  {busy === "chat" && (
                    <div className="ai-conversation__loading" role="status">
                      {t("loading")}
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              )}
            </section>

            <form
              className="ai-composer"
              onSubmit={(event) => void sendQuestion(event)}
            >
              <label htmlFor="ai-question">{t("inputLabel")}</label>
              <textarea
                id="ai-question"
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("inputPlaceholder")}
                maxLength={1000}
                rows={3}
                disabled={busy !== null || historyLoading}
              />
              <div className="ai-composer__actions">
                <span className="ai-composer__count">{draft.length}/1000</span>
                <div className="ai-composer__buttons">
                  <button
                    type="button"
                    className="ai-composer__export"
                    disabled={!draft.trim() || busy !== null}
                    onClick={() => void exportCsv()}
                  >
                    {busy === "export" ? t("exporting") : t("export")}
                  </button>
                  <button
                    type="submit"
                    disabled={!draft.trim() || busy !== null || historyLoading}
                  >
                    {busy === "chat" ? t("loading") : t("send")}
                  </button>
                </div>
              </div>
              {error && (
                <p className="ai-composer__error" role="alert">
                  {error}
                </p>
              )}
              {exportStatus && (
                <p className="ai-composer__status" role="status">
                  {exportStatus}
                </p>
              )}
              <p className="ai-composer__note">{t("stateless")}</p>
            </form>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

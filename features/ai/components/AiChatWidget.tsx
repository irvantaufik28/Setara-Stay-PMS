"use client";
import "./ai-chat-widget.css";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Icon } from "../../../components/ui/Icon";
import { AiMessageContent, hasAiMarkdownTable } from "./AiMessageContent";
import { AiLoadingIndicator } from "./AiLoadingIndicator";
import { restoreSession } from "../../../lib/auth";
import { useTranslations } from "../../../lib/i18n";
import {
  aiErrorText,
  askAi,
  exportAiCsv,
  getAiConversation,
  isAiExportCommand,
  listAiConversations,
  type AiMessage,
} from "../services/ai";
import en from "../locales/en.json";
import id from "../locales/id.json";

export function AiChatWidget({ suspended = false }: { suspended?: boolean }) {
  const pathname = usePathname();
  const { t } = useTranslations({ en, id });
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [entries, setEntries] = useState<AiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [exportStatus, setExportStatus] = useState("");
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onConversationDeleted(event: Event) {
      const deletedId = (event as CustomEvent<{ id: string }>).detail?.id;
      if (deletedId !== conversationId) return;
      setConversationId(null);
      setEntries([]);
      setHistoryLoaded(false);
      setHistoryError(false);
    }
    window.addEventListener("ai-conversation-deleted", onConversationDeleted);
    return () =>
      window.removeEventListener(
        "ai-conversation-deleted",
        onConversationDeleted,
      );
  }, [conversationId]);

  useEffect(() => {
    if (!open || historyLoaded) return;
    const controller = new AbortController();
    void (async () => {
      setHistoryLoading(true);
      try {
        if (!(await restoreSession()) || controller.signal.aborted) return;
        const list = await listAiConversations(0, controller.signal);
        if (controller.signal.aborted) return;
        if (list.items[0]) {
          const page = await getAiConversation(
            list.items[0].id,
            undefined,
            controller.signal,
          );
          if (controller.signal.aborted) return;
          setConversationId(page.conversation.id);
          setEntries(page.messages);
        }
        setHistoryLoaded(true);
      } catch {
        if (!controller.signal.aborted) {
          setHistoryError(true);
          setHistoryLoaded(true);
        }
      } finally {
        if (!controller.signal.aborted) setHistoryLoading(false);
      }
    })();
    return () => controller.abort();
  }, [open, historyLoaded]);

  useEffect(() => {
    if (open && !suspended && !historyLoading) inputRef.current?.focus();
  }, [open, suspended, historyLoading]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [entries, busy, open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        window.requestAnimationFrame(() => launcherRef.current?.focus());
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function send(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const message = draft.trim();
    if (!message || busy || historyLoading) return;
    if (isAiExportCommand(message)) {
      await exportCsv(message);
      return;
    }
    setBusy(true);
    setError("");
    setExportStatus("");
    setPendingQuestion(message);
    setDraft("");
    try {
      const response = await askAi(message, conversationId ?? undefined);
      setConversationId(response.conversationId);
      setEntries((current) => [
        ...current,
        response.userMessage,
        response.assistantMessage,
      ]);
    } catch (cause) {
      setDraft(message);
      setError(aiErrorText(cause, t, t("sendFailed")));
    } finally {
      setPendingQuestion("");
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  async function exportCsv(message: string) {
    setBusy(true);
    setExporting(true);
    setError("");
    setExportStatus("");
    try {
      const exported = await exportAiCsv(message, conversationId ?? undefined);
      setDraft("");
      setExportStatus(
        exported.rowCount === null
          ? t("exportSuccess")
          : t("exportSuccessRows", { count: exported.rowCount }),
      );
      if (exported.conversationId) {
        setConversationId(exported.conversationId);
        try {
          const page = await getAiConversation(exported.conversationId);
          setConversationId(page.conversation.id);
          setEntries(page.messages);
          setHistoryError(false);
        } catch {
          setHistoryError(true);
        }
      }
    } catch (cause) {
      setError(aiErrorText(cause, t, t("exportFailed")));
    } finally {
      setExporting(false);
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void send();
    }
  }

  if (pathname === "/ai" || suspended) return null;

  return (
    <div className="ai-widget">
      {open ? (
        <section
          className="ai-widget__panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="ai-widget-title"
        >
          <header className="ai-widget__header">
            <div className="ai-widget__identity">
              <Image
                className="ai-widget__avatar"
                src="/tara-assistant.png"
                alt=""
                width={48}
                height={48}
              />
              <div>
                <h2 id="ai-widget-title">{t("title")}</h2>
                <span className="ai-widget__subtitle">{t("widget.subtitle")}</span>
                <p>{t("widget.description")}</p>
              </div>
            </div>
            <div className="ai-widget__header-actions">
              <button
                type="button"
                className="ai-widget__new"
                disabled={busy || historyLoading}
                onClick={() => {
                  setConversationId(null);
                  setEntries([]);
                  setError("");
                  setExportStatus("");
                  setHistoryError(false);
                  inputRef.current?.focus();
                }}
              >
                {t("widget.new")}
              </button>
              <button
                type="button"
                className="ai-widget__close"
                aria-label={t("widget.close")}
                onClick={() => {
                  setOpen(false);
                  window.requestAnimationFrame(() =>
                    launcherRef.current?.focus(),
                  );
                }}
              >
                <Icon name="close" width={19} height={19} />
              </button>
            </div>
          </header>
          <div
            className="ai-widget__messages"
            role="log"
            aria-live="polite"
            aria-busy={busy || historyLoading}
          >
            {historyLoading ? (
              <p className="ai-widget__empty" role="status">
                {t("historyLoading")}
              </p>
            ) : entries.length === 0 && !pendingQuestion ? (
              <p className="ai-widget__empty">{t("widget.empty")}</p>
            ) : (
              <>
                {entries.map((entry) => (
                  <article
                    key={entry.id}
                    className={`ai-widget__message ai-widget__message--${entry.role}${entry.role === "assistant" && hasAiMarkdownTable(entry.content) ? " ai-widget__message--table" : ""}`}
                  >
                    <strong>
                      {entry.role === "user" ? t("you") : t("assistant")}
                    </strong>
                    {entry.role === "assistant" ? (
                      <AiMessageContent content={entry.content} />
                    ) : (
                      <p>{entry.content}</p>
                    )}
                    {entry.modelUsed && (
                      <small>{t("model", { model: entry.modelUsed })}</small>
                    )}
                  </article>
                ))}
                {pendingQuestion && (
                  <article className="ai-widget__message ai-widget__message--user">
                    <strong>{t("you")}</strong>
                    <p>{pendingQuestion}</p>
                  </article>
                )}
                {busy && !exporting && (
                  <AiLoadingIndicator
                    className="ai-widget__loading"
                    text={t("loading")}
                  />
                )}
              </>
            )}
            <div ref={bottomRef} />
          </div>
          <form
            className="ai-widget__composer"
            onSubmit={(event) => void send(event)}
          >
            <label htmlFor="ai-widget-question">{t("inputLabel")}</label>
            <textarea
              id="ai-widget-question"
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onComposerKeyDown}
              placeholder={t("widget.placeholder")}
              rows={2}
              maxLength={1000}
              disabled={busy || historyLoading}
            />
            {historyError && (
              <p className="ai-widget__error" role="alert">
                {t("historyError")}
              </p>
            )}
            {error && (
              <p className="ai-widget__error" role="alert">
                {error}
              </p>
            )}
            {exporting && (
              <p className="ai-widget__status" role="status">
                {t("exporting")}
              </p>
            )}
            {exportStatus && (
              <p className="ai-widget__status" role="status">
                {exportStatus}
              </p>
            )}
            <div className="ai-widget__actions">
              <Link href="/ai">{t("widget.fullPage")}</Link>
              <button
                type="submit"
                disabled={!draft.trim() || busy || historyLoading}
              >
                {t("send")}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <button
          ref={launcherRef}
          type="button"
          className="ai-widget__launcher"
          aria-label={t("widget.open")}
          title={t("widget.open")}
          onClick={() => setOpen(true)}
        >
          <Icon name="aiAssistant" width={31} height={31} />
        </button>
      )}
    </div>
  );
}

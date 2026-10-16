import "./ai-message-content.css";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

const allowedElements = [
  "p",
  "br",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "code",
  "pre",
  "blockquote",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "del",
];

export function AiMessageContent({ content }: { content: string }) {
  const closingThink = content.toLowerCase().lastIndexOf("</think>");
  const visibleContent =
    closingThink >= 0
      ? content.slice(closingThink + "</think>".length).trim()
      : content.replace(/<think>[\s\S]*$/i, "").trim();

  return (
    <div className="ai-markdown">
      <Markdown
        allowedElements={allowedElements}
        components={{
          table: ({ children }) => (
            <div
              className="ai-markdown__table-scroll"
              role="region"
              aria-label="Tabel data asisten"
              tabIndex={0}
            >
              <table>{children}</table>
            </div>
          ),
        }}
        remarkPlugins={[remarkGfm]}
        unwrapDisallowed
        skipHtml
      >
        {visibleContent}
      </Markdown>
    </div>
  );
}

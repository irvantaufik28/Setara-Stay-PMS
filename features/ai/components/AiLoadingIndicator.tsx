import "./ai-loading-indicator.css";

export function AiLoadingIndicator({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <div
      className={`ai-loading-indicator${className ? ` ${className}` : ""}`}
      role="status"
    >
      <span>{text.replace(/\.{3}$/, "")}</span>
      <span className="ai-loading-indicator__dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}

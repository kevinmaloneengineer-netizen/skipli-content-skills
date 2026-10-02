import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

// Agent reports: GFM tables + bare-URL autolinks, single newlines kept (posts are line-based).
// Headings shift down one level because the page owns <h1>. Raw HTML is never rendered.
const components = {
  h1: ({ node, ...p }) => <h2 {...p} />,
  h2: ({ node, ...p }) => <h3 {...p} />,
  h3: ({ node, ...p }) => <h4 {...p} />,
  h4: ({ node, ...p }) => <h5 {...p} />,
  a: ({ node, ...p }) => <a {...p} target="_blank" rel="noopener noreferrer" />,
  table: ({ node, ...p }) => (
    <div className="table-wrap">
      <table {...p} />
    </div>
  ),
};

export default function Markdown({ children, className = "md" }) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
        {children ?? ""}
      </ReactMarkdown>
    </div>
  );
}

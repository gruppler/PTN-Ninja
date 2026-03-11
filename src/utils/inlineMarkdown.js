// Lightweight inline markdown renderer for user notes.
// Supports: **bold**, *italic*, ~~strikethrough~~, `code`, [links](url)

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function inlineMarkdown(text) {
  if (!text) return "";

  let html = escapeHtml(text);

  // `code`
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // **bold**
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // *italic*
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // ~~strikethrough~~
  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");

  // [text](url)
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>'
  );

  // Newlines
  html = html.replace(/\n/g, "<br>");

  return html;
}

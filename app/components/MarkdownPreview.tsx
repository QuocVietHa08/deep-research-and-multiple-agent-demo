"use client";

import { Fragment } from "react";

type InlineToken =
  | { type: "text"; value: string }
  | { type: "code"; value: string }
  | { type: "link"; text: string; href: string }
  | { type: "url"; value: string };

function tokenizeInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let i = 0;

  const pushText = (value: string) => {
    if (!value) return;
    tokens.push({ type: "text", value });
  };

  while (i < text.length) {
    const ch = text[i];

    // Inline code: `...`
    if (ch === "`") {
      const end = text.indexOf("`", i + 1);
      if (end !== -1) {
        tokens.push({ type: "code", value: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    // Markdown link: [text](https://...)
    if (ch === "[") {
      const closeBracket = text.indexOf("]", i + 1);
      const openParen = closeBracket !== -1 ? text.indexOf("(", closeBracket) : -1;
      const closeParen =
        openParen !== -1 ? text.indexOf(")", openParen + 1) : -1;

      if (
        closeBracket !== -1 &&
        openParen === closeBracket + 1 &&
        closeParen !== -1
      ) {
        const linkText = text.slice(i + 1, closeBracket);
        const href = text.slice(openParen + 1, closeParen);
        if (/^https?:\/\//.test(href)) {
          tokens.push({ type: "link", text: linkText, href });
          i = closeParen + 1;
          continue;
        }
      }
    }

    // Bare URL
    if (text.startsWith("http://", i) || text.startsWith("https://", i)) {
      let j = i;
      while (j < text.length && !/\s/.test(text[j])) j++;
      tokens.push({ type: "url", value: text.slice(i, j) });
      i = j;
      continue;
    }

    // Default: consume until next special token start
    let nextSpecial = text.length;
    const backtick = text.indexOf("`", i + 1);
    const bracket = text.indexOf("[", i + 1);
    const http = text.indexOf("http://", i + 1);
    const https = text.indexOf("https://", i + 1);

    nextSpecial = Math.min(
      backtick === -1 ? text.length : backtick,
      bracket === -1 ? text.length : bracket,
      http === -1 ? text.length : http,
      https === -1 ? text.length : https
    );

    pushText(text.slice(i, nextSpecial));
    i = nextSpecial;
  }

  return tokens.length ? tokens : [{ type: "text", value: text }];
}

function renderInline(text: string) {
  const tokens = tokenizeInline(text);

  return tokens.map((t, idx) => {
    if (t.type === "text") return <Fragment key={idx}>{t.value}</Fragment>;
    if (t.type === "code")
      return (
        <code
          key={idx}
          className="px-1 py-0.5 rounded bg-muted text-sm font-mono"
        >
          {t.value}
        </code>
      );
    if (t.type === "link")
      return (
        <a
          key={idx}
          href={t.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
        >
          {t.text}
        </a>
      );
    return (
      <a
        key={idx}
        href={t.value}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 break-all"
      >
        {t.value}
      </a>
    );
  });
}

type Block =
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { type: "paragraph"; text: string }
  | { type: "hr" }
  | { type: "list"; items: string[] }
  | { type: "olist"; items: string[] }
  | { type: "code"; code: string; lang?: string };

function parseMarkdown(content: string): Block[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];

  let i = 0;

  const flushParagraph = (paragraph: string) => {
    const text = paragraph.trim();
    if (!text) return;
    blocks.push({ type: "paragraph", text });
  };

  while (i < lines.length) {
    const line = lines[i] ?? "";

    // Code block
    const codeFenceMatch = line.match(/^```(\w+)?\s*$/);
    if (codeFenceMatch) {
      const lang = codeFenceMatch[1];
      i += 1;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      // Skip closing fence
      if (i < lines.length && lines[i].startsWith("```")) i += 1;
      blocks.push({ type: "code", lang, code: codeLines.join("\n") });
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = Math.min(6, headingMatch[1].length) as 1 | 2 | 3 | 4 | 5 | 6;
      blocks.push({
        type: "heading",
        level,
        text: headingMatch[2].trim(),
      });
      i += 1;
      continue;
    }

    // Horizontal rule: `---` (common in generated markdown)
    if (/^(\s*---\s*)+$/.test(line.trim())) {
      blocks.push({ type: "hr" });
      i += 1;
      continue;
    }

    // Unordered lists (only `- ` or `* ` at the start)
    const listItemMatch = line.match(/^(\s*[-*])\s+(.*)$/);
    if (listItemMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = (lines[i] ?? "").match(/^(\s*[-*])\s+(.*)$/);
        if (!m) break;
        items.push(m[2]);
        i += 1;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    // Ordered lists: `1. foo`
    const orderedItemMatch = line.match(/^\s*\d+\.\s+(.*)$/);
    if (orderedItemMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = (lines[i] ?? "").match(/^\s*\d+\.\s+(.*)$/);
        if (!m) break;
        items.push(m[1]);
        i += 1;
      }
      blocks.push({ type: "olist", items });
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      i += 1;
      continue;
    }

    // Paragraph: consume until blank line or a new block marker
    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const cur = lines[i] ?? "";
      if (cur.trim() === "") break;
      if (/^```/.test(cur)) break;
      if (/^(#{1,6})\s+/.test(cur)) break;
      if (/^(\s*[-*])\s+/.test(cur)) break;
      paragraphLines.push(cur);
      i += 1;
    }

    flushParagraph(paragraphLines.join("\n"));
  }

  return blocks;
}

export function MarkdownPreview({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const blocks = useMemoParse(content);

  return (
    <div className={className ?? ""}>
      {blocks.map((b, idx) => {
        if (b.type === "heading") {
          const sizes: Record<number, string> = {
            1: "text-2xl font-bold mt-4 mb-2",
            2: "text-xl font-bold mt-4 mb-2",
            3: "text-lg font-semibold mt-3 mb-2",
            4: "text-base font-semibold mt-3 mb-2",
            5: "text-base font-medium mt-3 mb-2",
            6: "text-sm font-medium mt-3 mb-2",
          };
          return (
            <div key={idx} className={sizes[b.level]}>
              {renderInline(b.text)}
            </div>
          );
        }

        if (b.type === "code") {
          return (
            <pre
              key={idx}
              className="mt-4 mb-4 overflow-auto rounded-md bg-muted p-3 text-sm border"
            >
              <code className="font-mono">{b.code}</code>
            </pre>
          );
        }

        if (b.type === "hr") {
          return (
            <hr
              key={idx}
              className="my-4 border-t border-border"
            />
          );
        }

        if (b.type === "list") {
          return (
            <ul
              key={idx}
              className="list-disc pl-5 mt-3 mb-3 space-y-1 text-sm"
            >
              {b.items.map((item, i2) => (
                <li key={i2}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }

        if (b.type === "olist") {
          return (
            <ol
              key={idx}
              className="list-decimal pl-5 mt-3 mb-3 space-y-1 text-sm"
            >
              {b.items.map((item, i2) => (
                <li key={i2}>{renderInline(item)}</li>
              ))}
            </ol>
          );
        }

        return (
          <p key={idx} className="mt-2 mb-2 text-sm leading-6">
            {renderInline(b.text)}
          </p>
        );
      })}
    </div>
  );
}

function useMemoParse(content: string): Block[] {
  // Tiny local memo helper to avoid importing `useMemo` just for this file.
  // Next renders are cheap for typical response sizes.
  return parseMarkdown(content);
}


"use client";

type CanvasLayoutProps = {
  chat: React.ReactNode;
  canvas: React.ReactNode;
};

export function CanvasLayout({ chat, canvas }: CanvasLayoutProps) {
  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Chat panel — 38% */}
      <div
        className="flex flex-col h-full overflow-hidden border-r border-[var(--color-border-tertiary,#e5e7eb)]"
        style={{ width: "38%" }}
      >
        {chat}
      </div>

      {/* Canvas panel — remaining 62% */}
      <div className="flex flex-col h-full overflow-hidden" style={{ flex: 1 }}>
        {canvas}
      </div>
    </div>
  );
}

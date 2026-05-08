"use client";

export default function Marquee({
  children,
  itemCount,
  gap = 16,
  reverse = false,
}: {
  children: React.ReactNode;
  itemCount: number;
  gap?: number;
  reverse?: boolean;
}) {
  const duration = Math.max(itemCount * 4, 16);

  return (
    <div className="marquee-outer overflow-hidden">
      <div
        className={`marquee-track flex w-max ${reverse ? "marquee-reverse" : ""}`}
        style={{ animationDuration: `${duration}s`, gap: `${gap}px` }}
      >
        <div className="flex flex-shrink-0" style={{ gap: `${gap}px` }}>
          {children}
        </div>
        <div className="flex flex-shrink-0" style={{ gap: `${gap}px` }} aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}

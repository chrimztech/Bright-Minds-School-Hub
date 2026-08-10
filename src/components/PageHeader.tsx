import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="no-print px-4 pt-5 sm:px-6 sm:pt-6 lg:px-8 lg:pt-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-px w-5 bg-brand-gold" />
            <span className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              School workspace
            </span>
          </div>
          <h1 className="font-display text-[2rem] font-semibold leading-none tracking-tight text-foreground sm:text-[2.2rem]">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </header>
  );
}

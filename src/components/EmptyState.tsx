import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  message?: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({
  icon: Icon,
  message = "No records yet.",
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {Icon && (
        <div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/10 to-brand-sky/10 shadow-sm">
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-brand-gold/80 ring-4 ring-background" />
          <Icon className="h-6 w-6 text-primary/65" />
        </div>
      )}
      <p className="text-sm font-bold text-foreground">{message}</p>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground max-w-xs leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

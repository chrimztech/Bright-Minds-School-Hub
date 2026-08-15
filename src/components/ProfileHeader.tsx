import type { ReactNode } from "react";

export interface ProfileMetaItem {
  icon: any;
  label: string;
  value: ReactNode;
}

export function profileInitials(fullName: string) {
  return fullName.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

export function ProfileHeader({
  photoUrl,
  name,
  subtitle,
  badges,
  meta,
}: {
  photoUrl?: string;
  name: string;
  subtitle?: string;
  badges?: ReactNode;
  meta?: ProfileMetaItem[];
}) {
  const initials = profileInitials(name);
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-depth-sm">
      <div className="h-2.5 bg-primary" />
      <div className="h-[3px] bg-brand-gold" />
      <div className="p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-4">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={name}
              className="h-16 w-16 shrink-0 rounded-full border border-border object-cover sm:h-[72px] sm:w-[72px]"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground sm:h-[72px] sm:w-[72px] sm:text-xl">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold leading-normal text-foreground sm:text-xl">
              {name}
            </p>
            {subtitle && <p className="mt-0.5 text-sm leading-normal text-muted-foreground">{subtitle}</p>}
          </div>
          {badges && <div className="flex flex-wrap items-center gap-2">{badges}</div>}
        </div>

        {meta && meta.length > 0 && (
          <div className="mt-5 grid gap-x-6 gap-y-4 border-t border-border/60 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            {meta.map((m, i) => (
              <div key={i} className="flex items-center gap-2.5 min-w-0">
                <m.icon className="h-4 w-4 shrink-0 text-brand-gold" strokeWidth={2} />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none mb-1">{m.label}</p>
                  <p className="truncate text-sm font-semibold text-foreground leading-none">{m.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="h-px w-4 bg-brand-gold" />
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}

export function Field({ icon: Icon, label, value }: { icon?: any; label: string; value: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />}
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium text-foreground break-words">{value}</p>
      </div>
    </div>
  );
}

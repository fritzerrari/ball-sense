import { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="glass-card p-12 text-center">
      <div className="text-muted-foreground/30 mb-3 flex justify-center">{icon}</div>
      <p className="text-muted-foreground mb-1 font-medium">{title}</p>
      {description && <p className="text-sm text-muted-foreground/70 mb-4">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

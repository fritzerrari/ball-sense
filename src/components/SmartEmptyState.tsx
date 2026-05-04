import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Sparkles, type LucideIcon } from "lucide-react";

type Action = { label: string; to?: string; onClick?: () => void };

export function SmartEmptyState({
  icon: Icon = Sparkles,
  title,
  hint,
  primary,
  secondary,
}: {
  icon?: LucideIcon;
  title: string;
  hint: string;
  primary?: Action;
  secondary?: Action;
}) {
  return (
    <Card className="p-8 text-center border-dashed">
      <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="font-semibold text-base">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{hint}</p>
      {(primary || secondary) && (
        <div className="flex gap-2 justify-center mt-4 flex-wrap">
          {primary && (primary.to ? (
            <Button asChild><Link to={primary.to}>{primary.label}</Link></Button>
          ) : (
            <Button onClick={primary.onClick}>{primary.label}</Button>
          ))}
          {secondary && (secondary.to ? (
            <Button asChild variant="outline"><Link to={secondary.to}>{secondary.label}</Link></Button>
          ) : (
            <Button variant="outline" onClick={secondary.onClick}>{secondary.label}</Button>
          ))}
        </div>
      )}
    </Card>
  );
}

import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Plus, Map, Crosshair } from "lucide-react";

export default function Fields() {
  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold font-display">Plätze</h1>
          <Button variant="hero" size="sm">
            <Plus className="h-4 w-4 mr-1" /> Platz hinzufügen
          </Button>
        </div>
        <div className="glass-card p-12 text-center">
          <Map className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">Noch keine Plätze angelegt</p>
          <Button variant="heroOutline">Platz hinzufügen</Button>
        </div>
      </div>
    </AppLayout>
  );
}

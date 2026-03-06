import AppLayout from "@/components/AppLayout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, Swords } from "lucide-react";

export default function Matches() {
  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold font-display">Spiele</h1>
          <Button variant="hero" size="sm" asChild>
            <Link to="/matches/new"><Plus className="h-4 w-4 mr-1" /> Neues Spiel</Link>
          </Button>
        </div>
        <div className="glass-card p-12 text-center">
          <Swords className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">Noch keine Spiele angelegt</p>
          <Button variant="heroOutline" asChild>
            <Link to="/matches/new">Erstes Spiel anlegen</Link>
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}

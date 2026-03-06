import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Plus, Users, Search } from "lucide-react";
import { useState } from "react";

export default function Players() {
  const [search, setSearch] = useState("");

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold font-display">Kader</h1>
          <Button variant="hero" size="sm">
            <Plus className="h-4 w-4 mr-1" /> Spieler hinzufügen
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Spieler suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground"
          />
        </div>
        <div className="glass-card p-12 text-center">
          <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">Noch keine Spieler im Kader</p>
          <Button variant="heroOutline">Spieler hinzufügen</Button>
        </div>
      </div>
    </AppLayout>
  );
}

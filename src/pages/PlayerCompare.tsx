import { useSearchParams } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import PlayerComparison from "@/components/PlayerComparison";

export default function PlayerCompare() {
  const [params] = useSearchParams();
  const p1 = params.get("p1") ?? undefined;
  const p2 = params.get("p2") ?? undefined;

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-2xl font-bold font-display">Spieler-Vergleich</h1>
        <PlayerComparison preselectedPlayer1={p1} preselectedPlayer2={p2} />
      </div>
    </AppLayout>
  );
}

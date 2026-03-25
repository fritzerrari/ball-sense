import { Card, CardContent } from "@/components/ui/card";
import { Star, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

interface SpotlightPlayer {
  description: string;
  key_actions?: string;
  rating?: number;
  issues?: string;
  recommendation?: string;
}

interface Props {
  mvp: SpotlightPlayer;
  concern: SpotlightPlayer;
}

export default function PlayerSpotlight({ mvp, concern }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.45 }}
      className="grid sm:grid-cols-2 gap-4"
    >
      {/* MVP */}
      <Card className="relative overflow-hidden border-emerald-500/20 bg-gradient-to-br from-card to-emerald-500/5">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-500 to-emerald-400" />
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15">
              <Star className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-emerald-500">MVP</p>
              {mvp.rating && (
                <span className="text-lg font-black font-display text-emerald-500">{mvp.rating.toFixed(1)}</span>
              )}
            </div>
          </div>
          <p className="text-sm font-medium">{mvp.description}</p>
          {mvp.key_actions && (
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{mvp.key_actions}</p>
          )}
        </CardContent>
      </Card>

      {/* Concern */}
      <Card className="relative overflow-hidden border-amber-500/20 bg-gradient-to-br from-card to-amber-500/5">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-amber-500 to-orange-400" />
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15">
              <AlertCircle className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-[10px] uppercase tracking-widest text-amber-500">Sorgenspieler</p>
          </div>
          <p className="text-sm font-medium">{concern.description}</p>
          {concern.issues && (
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{concern.issues}</p>
          )}
          {concern.recommendation && (
            <p className="text-xs text-primary mt-2 leading-relaxed">→ {concern.recommendation}</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

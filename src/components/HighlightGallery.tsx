import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Film, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface HighlightVideo {
  id: string;
  file_path: string;
  event_type: string | null;
  event_minute: number | null;
  duration_sec: number | null;
  file_size_bytes: number | null;
}

const EVENT_LABELS: Record<string, string> = {
  goal: "⚽ Tor",
  shot_on_target: "⚡ Chance",
  yellow_card: "🟡 Gelbe Karte",
  corner: "📐 Ecke",
  red_card: "🔴 Rote Karte",
};

export default function HighlightGallery({ matchId }: { matchId: string }) {
  const [videos, setVideos] = useState<HighlightVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase
      .from("match_videos")
      .select("id, file_path, event_type, event_minute, duration_sec, file_size_bytes")
      .eq("match_id", matchId)
      .eq("video_type", "highlight")
      .order("event_minute")
      .then(({ data }) => {
        const items = (data ?? []) as HighlightVideo[];
        setVideos(items);
        setLoading(false);

        // Generate signed URLs
        items.forEach(async (v) => {
          const { data: urlData } = await supabase.storage
            .from("match-videos")
            .createSignedUrl(v.file_path, 3600);
          if (urlData?.signedUrl) {
            setUrls((prev) => ({ ...prev, [v.id]: urlData.signedUrl }));
          }
        });
      });
  }, [matchId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (videos.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Film className="h-5 w-5 text-primary" />
        <h2 className="font-semibold font-display">Video-Highlights</h2>
        <Badge variant="outline" className="text-[10px]">{videos.length} Clips</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {videos.map((v) => (
          <Card key={v.id}>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="text-xs bg-primary/10 text-primary border-0">
                    {v.event_minute ? `${v.event_minute}'` : "–"}
                  </Badge>
                  <span className="text-sm font-medium">
                    {EVENT_LABELS[v.event_type ?? ""] ?? v.event_type ?? "Highlight"}
                  </span>
                </div>
                {v.file_size_bytes && (
                  <span className="text-[10px] text-muted-foreground">
                    {(v.file_size_bytes / 1024 / 1024).toFixed(1)} MB
                  </span>
                )}
              </div>

              {urls[v.id] ? (
                <video
                  src={urls[v.id]}
                  controls
                  className="w-full rounded-lg bg-black aspect-video"
                  preload="metadata"
                />
              ) : (
                <div className="w-full aspect-video bg-muted rounded-lg flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}

              {urls[v.id] && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 text-xs"
                  asChild
                >
                  <a href={urls[v.id]} download={`highlight_${v.event_type}_${v.event_minute}.webm`}>
                    <Download className="h-3 w-3" /> Download
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

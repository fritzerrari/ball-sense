import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function ClubLogoUpload() {
  const { clubId, clubLogoUrl } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(clubLogoUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clubId) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Datei zu groß (max. 2 MB)");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Nur Bilder erlaubt");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${clubId}/logo.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("club-logos")
        .upload(path, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("club-logos")
        .getPublicUrl(path);

      const logoUrl = urlData.publicUrl + "?t=" + Date.now();

      const { error: updateErr } = await supabase
        .from("clubs")
        .update({ logo_url: logoUrl })
        .eq("id", clubId);

      if (updateErr) throw updateErr;

      setPreview(logoUrl);
      toast.success("Logo hochgeladen!");
      // Reload to refresh AuthProvider
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      toast.error("Upload fehlgeschlagen");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!clubId) return;
    setUploading(true);
    try {
      await supabase.from("clubs").update({ logo_url: null }).eq("id", clubId);
      setPreview(null);
      toast.success("Logo entfernt");
      setTimeout(() => window.location.reload(), 800);
    } catch {
      toast.error("Fehler beim Entfernen");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div
        className="w-16 h-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center cursor-pointer overflow-hidden hover:border-primary/50 transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          <img src={preview} alt="Logo" className="w-full h-full object-cover" />
        ) : (
          <Camera className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
      <div className="space-y-1">
        <div className="flex gap-2">
          <Button
            variant="heroOutline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {preview ? "Ändern" : "Logo hochladen"}
          </Button>
          {preview && (
            <Button variant="ghost" size="sm" onClick={handleRemove} disabled={uploading}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG · max. 2 MB</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
}

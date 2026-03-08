import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Plus, Map, Pencil, Trash2, Crosshair, Calendar } from "lucide-react";
import { useState } from "react";
import { useFields, useCreateField, useUpdateField, useDeleteField } from "@/hooks/use-fields";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SkeletonCard } from "@/components/SkeletonCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation, useLocale } from "@/lib/i18n";

export default function Fields() {
  const { data: fields, isLoading } = useFields();
  const createField = useCreateField();
  const updateField = useUpdateField();
  const deleteField = useDeleteField();
  const { t } = useTranslation();
  const locale = useLocale();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formWidth, setFormWidth] = useState("105");
  const [formHeight, setFormHeight] = useState("68");

  const openCreate = () => { setEditingField(null); setFormName(""); setFormWidth("105"); setFormHeight("68"); setDialogOpen(true); };
  const openEdit = (field: any) => { setEditingField(field); setFormName(field.name); setFormWidth(String(field.width_m)); setFormHeight(String(field.height_m)); setDialogOpen(true); };

  const handleSubmit = async () => {
    if (!formName.trim()) return;
    const data = { name: formName.trim(), width_m: parseFloat(formWidth) || 105, height_m: parseFloat(formHeight) || 68 };
    if (editingField) { await updateField.mutateAsync({ id: editingField.id, ...data }); } else { await createField.mutateAsync(data); }
    setDialogOpen(false);
  };

  const handleDelete = async () => { if (deleteId) { await deleteField.mutateAsync(deleteId); setDeleteId(null); } };
  const isCalibrated = (field: any) => !!field.calibration;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display">{t("fields.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("fields.subtitle")}</p>
          </div>
          <Button variant="hero" size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> {t("fields.add")}
          </Button>
        </div>

        {isLoading ? (
          <SkeletonCard count={2} />
        ) : !fields || fields.length === 0 ? (
          <EmptyState
            icon={<Map className="h-10 w-10" />}
            title={t("fields.noFields")}
            description={t("fields.addFirst")}
            action={<Button variant="heroOutline" onClick={openCreate}>{t("fields.add")}</Button>}
          />
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {fields.map((field) => (
              <div key={field.id} className="glass-card p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold font-display">{field.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{field.width_m} × {field.height_m} m</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${isCalibrated(field) ? "bg-emerald-500/20 text-emerald-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                    {isCalibrated(field) ? t("fields.calibrated") : t("fields.notCalibrated")}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(field.created_at).toLocaleDateString(locale)}
                </div>
                <div className="flex gap-2">
                  <Button variant="heroOutline" size="sm" asChild className="flex-1">
                    <Link to={`/fields/${field.id}/calibrate`}><Crosshair className="h-4 w-4 mr-1" /> {t("fields.calibrate")}</Link>
                  </Button>
                  <button onClick={() => openEdit(field)} className="p-2 rounded-lg hover:bg-muted transition-colors"><Pencil className="h-4 w-4 text-muted-foreground" /></button>
                  <button onClick={() => setDeleteId(field.id)} className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"><Trash2 className="h-4 w-4 text-destructive/70" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">{editingField ? t("fields.editField") : t("fields.addField")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t("common.name")} *</label>
              <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Hauptplatz" className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{t("fields.width")}</label>
                <input type="number" value={formWidth} onChange={(e) => setFormWidth(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">{t("fields.length")}</label>
                <input type="number" value={formHeight} onChange={(e) => setFormHeight(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm" />
              </div>
            </div>
            <Button variant="hero" className="w-full" onClick={handleSubmit} disabled={!formName.trim()}>
              {editingField ? t("common.save") : t("common.add")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title={t("fields.deleteTitle")}
        description={t("fields.deleteDesc")}
        confirmLabel={t("common.delete")}
        onConfirm={handleDelete}
        destructive
      />
    </AppLayout>
  );
}

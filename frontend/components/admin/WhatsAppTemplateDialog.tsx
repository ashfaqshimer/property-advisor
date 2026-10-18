"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { IoLogoWhatsapp } from "react-icons/io";
import { RotateCcw, Check, Sparkles, HelpCircle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DEFAULT_WHATSAPP_OUTREACH_TEMPLATE,
  getStoredWhatsAppTemplate,
  setStoredWhatsAppTemplate,
  clearStoredWhatsAppTemplate,
  renderOutreachTemplate,
  ProspectOutreachDetails,
} from "@/lib/whatsapp";

interface WhatsAppTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sampleProspect?: ProspectOutreachDetails | null;
  onTemplateSaved?: (savedTemplate: string) => void;
}

const DEFAULT_SAMPLE: ProspectOutreachDetails = {
  poster_name: "Kamal Perera",
  title: "Modern 3 Bedroom House in Thalawathugoda",
  ikman_url: "https://ikman.lk/en/ad/modern-3-bedroom-house-for-sale",
  suburb: "Thalawathugoda",
  location: "Thalawathugoda",
};

export function WhatsAppTemplateDialog({
  isOpen,
  onClose,
  sampleProspect,
  onTemplateSaved,
}: WhatsAppTemplateDialogProps) {
  const [template, setTemplate] = useState<string>(DEFAULT_WHATSAPP_OUTREACH_TEMPLATE);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const stored = getStoredWhatsAppTemplate();
      setTemplate(stored?.trim() || DEFAULT_WHATSAPP_OUTREACH_TEMPLATE);
    }
  }, [isOpen]);

  const activeSample = sampleProspect || DEFAULT_SAMPLE;
  const previewText = renderOutreachTemplate(template, activeSample);

  const handleInsertTag = (tag: string) => {
    setTemplate((prev) => prev + tag);
  };

  const handleResetDefault = () => {
    setTemplate(DEFAULT_WHATSAPP_OUTREACH_TEMPLATE);
    clearStoredWhatsAppTemplate();
    toast.info("Reset to default template");
  };

  const handleSave = () => {
    setIsSaving(true);
    try {
      const trimmed = template.trim();
      setStoredWhatsAppTemplate(trimmed);
      onTemplateSaved?.(trimmed);
      toast.success("WhatsApp outreach template saved");
      onClose();
    } catch {
      toast.error("Failed to save template");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-[#25D366]">
              <IoLogoWhatsapp className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                WhatsApp Outreach Template
              </DialogTitle>
              <DialogDescription className="text-xs">
                Configure the message sent to property prospects on WhatsApp.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Variables helper */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <span>Insert Dynamic Placeholders:</span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              <Badge
                variant="outline"
                className="cursor-pointer hover:bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] py-1"
                onClick={() => handleInsertTag("{name}")}
                title="Inserts owner/poster name (e.g. Kamal)"
              >
                + &#123;name&#125;
              </Badge>
              <Badge
                variant="outline"
                className="cursor-pointer hover:bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] py-1"
                onClick={() => handleInsertTag("{title}")}
                title="Inserts listing title"
              >
                + &#123;title&#125;
              </Badge>
              <Badge
                variant="outline"
                className="cursor-pointer hover:bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] py-1"
                onClick={() => handleInsertTag("{url}")}
                title="Inserts Ikman or LPW link"
              >
                + &#123;url&#125;
              </Badge>
              <Badge
                variant="outline"
                className="cursor-pointer hover:bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] py-1"
                onClick={() => handleInsertTag("{area}")}
                title="Inserts suburb or location (e.g. Thalawathugoda)"
              >
                + &#123;area&#125;
              </Badge>
            </div>
          </div>

          {/* Template Textarea */}
          <div className="space-y-1.5">
            <Label htmlFor="whatsapp-template-text" className="text-xs font-semibold">
              Template Text
            </Label>
            <Textarea
              id="whatsapp-template-text"
              rows={8}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="font-sans text-xs leading-relaxed"
              placeholder="Write your WhatsApp message here..."
            />
          </div>

          {/* Live Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span className="flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                Live Preview
              </span>
              <span className="text-[11px] text-muted-foreground font-normal">
                {sampleProspect ? "Using current prospect" : "Sample preview"}
              </span>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-xs whitespace-pre-wrap font-sans text-foreground leading-relaxed max-h-44 overflow-y-auto">
              {previewText}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetDefault}
            className="text-xs gap-1 text-muted-foreground hover:text-foreground cursor-pointer self-start sm:self-auto"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset to Default</span>
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !template.trim()}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
            >
              Save Template
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

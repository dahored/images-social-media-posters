"use client";

import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Layers, X } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { AspectRatioSelector } from "@/components/editor/AspectRatioSelector";
import type { AspectRatio } from "@/types/carousel";
import type { Network, NetworkFormat, NetworkRatio } from "@/types/network";

interface CreateCarouselDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, aspectRatio: AspectRatio, networkId?: string) => void;
}

export function CreateCarouselDialog({
  open,
  onOpenChange,
  onCreate,
}: CreateCarouselDialogProps) {
  const [name, setName] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("4:5");
  const [networks, setNetworks] = useState<Network[]>([]);
  const [selectedNetworkId, setSelectedNetworkId] = useState<string>("instagram");
  const [selectedFormatId, setSelectedFormatId] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    fetch("/api/networks")
      .then((r) => r.json())
      .then((d) => {
        const nets: Network[] = d.networks || [];
        setNetworks(nets);
        if (nets.length > 0 && !selectedNetworkId) {
          setSelectedNetworkId(nets[0].id);
        }
      })
      .catch(() => {});
  }, [open, selectedNetworkId]);

  const selectedNetwork = networks.find((n) => n.id === selectedNetworkId);
  const carouselFormats: NetworkFormat[] = selectedNetwork?.formats.filter(
    (f) => f.id === "carousel" || f.ratios.length > 1
  ) || [];
  const formats = carouselFormats.length > 0 ? carouselFormats : selectedNetwork?.formats || [];

  const selectedFormat = formats.find((f) => f.id === selectedFormatId) || formats[0];

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed, aspectRatio, selectedNetworkId || undefined);
    setName("");
    setAspectRatio("4:5");
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay data-oc-overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content data-oc-dialog className="fixed left-1/2 top-1/2 z-50 w-full max-w-md rounded-xl bg-surface border border-border p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center">
                <Layers className="h-4 w-4 text-accent" />
              </div>
              <Dialog.Title className="text-base font-semibold">
                New Carousel
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Carousel Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., 5 Tips for Remote Work"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
              />
            </div>

            {networks.length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Network
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {networks.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => { setSelectedNetworkId(n.id); setSelectedFormatId(""); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        selectedNetworkId === n.id
                          ? "bg-foreground text-background border-foreground"
                          : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                      }`}
                    >
                      {n.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {formats.length > 1 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Format
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {formats.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setSelectedFormatId(f.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-colors cursor-pointer ${
                        (selectedFormatId === f.id || (!selectedFormatId && f.id === formats[0]?.id))
                          ? "bg-foreground text-background border-foreground"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedFormat && selectedFormat.ratios.length > 1 ? (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Ratio
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {selectedFormat.ratios.map((r: NetworkRatio) => {
                    const ratio = r.ratio as AspectRatio;
                    return (
                      <button
                        key={r.ratio}
                        onClick={() => {
                          if (["1:1", "4:5", "9:16"].includes(r.ratio)) {
                            setAspectRatio(ratio);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs border transition-colors cursor-pointer ${
                          aspectRatio === r.ratio
                            ? "bg-foreground text-background border-foreground"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {r.label} ({r.ratio})
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Aspect Ratio
                </label>
                <AspectRatioSelector
                  value={aspectRatio}
                  onChange={setAspectRatio}
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Dialog.Close asChild>
              <Button variant="outline" size="sm">
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              variant="accent"
              size="sm"
              onClick={handleCreate}
              disabled={!name.trim()}
            >
              Create
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

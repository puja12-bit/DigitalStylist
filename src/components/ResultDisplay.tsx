// src/components/ResultDisplay.tsx
import React from "react";
import { UserProfile, OutfitRecommendation } from "../types";

type Props = {
  profile: UserProfile;
  recommendation?: OutfitRecommendation | null;
  occasion?: string;
  generatedImage2D?: string | null;
  generatedImageReal?: string | null;
  isGenerating2D?: boolean;
  onGenerateReal: () => void;
  onReset: () => void;
};

const ResultDisplay: React.FC<Props> = ({
  profile,
  recommendation,
  occasion,
  generatedImage2D,
  generatedImageReal,
  isGenerating2D = false,
  onGenerateReal,
  onReset,
}) => {
  const [viewMode, setViewMode] = React.useState<"2D" | "REAL">("2D");

  // Defensive: if no recommendation yet, show placeholder info (keeps UI stable)
  if (!recommendation) {
    return (
      <div className="min-h-[calc(100vh-4rem)] w-full max-w-6xl mx-auto px-4 py-6 sm:py-10">
        <div className="flex items-center justify-between mb-6 gap-3">
          <button onClick={onReset} className="text-sm text-neutral-600">← Back to styling</button>
          <div className="text-right">
            <div className="text-xs uppercase text-neutral-500">For</div>
            <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{occasion || "Your occasion"}</div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-6 lg:gap-8 items-start">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-md border p-4 flex flex-col">
            <div className="text-xs uppercase text-neutral-500 mb-4">Visual preview</div>
            <div className="flex-1 flex items-center justify-center rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-dashed p-6">
              <div className="text-center text-sm text-neutral-500">No recommendation yet. Click “Get My Look”.</div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white dark:bg-neutral-900 border rounded-2xl p-4 shadow-sm">
              <div className="text-xs uppercase text-neutral-500 mb-1">Overall vibe</div>
              <div className="text-sm text-neutral-900 dark:text-neutral-50">—</div>
            </div>

            <div className="bg-white dark:bg-neutral-900 border rounded-2xl p-4 shadow-sm">
              <div className="text-xs uppercase text-neutral-500 mb-2">Outfit breakdown</div>
              <div className="text-sm text-neutral-600">No items yet</div>
            </div>

            <div className="bg-white dark:bg-neutral-900 border rounded-2xl p-4 shadow-sm">
              <div className="text-xs uppercase text-neutral-500 mb-1">Hair & finishing</div>
              <div className="text-sm text-neutral-900 dark:text-neutral-50">—</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Normal flow: we have recommendation
  const activeImage = viewMode === "2D" ? generatedImage2D : generatedImageReal;
  const hasReal = Boolean(generatedImageReal);

  return (
    <div className="min-h-[calc(100vh-4rem)] w-full max-w-6xl mx-auto px-4 py-6 sm:py-10">
      <div className="flex items-center justify-between mb-6 gap-3">
        <button onClick={onReset} className="inline-flex items-center gap-2 text-sm text-neutral-600">
          <span className="text-lg">←</span>
          Back to styling
        </button>

        <div className="text-right">
          <div className="text-xs uppercase text-neutral-500">For</div>
          <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            {occasion || (recommendation as any).occasion || "Your occasion"}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-6 lg:gap-8 items-start">
        {/* LEFT: Image + tabs */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-md border p-4 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs uppercase text-neutral-500">Visual preview</div>
              <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{profile.name || "Your look"}</div>
            </div>

            <div className="inline-flex text-xs rounded-full border px-3 py-1 text-neutral-600">
              {profile.gender || "Gender?"} • {profile.skinTone || "Skin tone?"}
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => setViewMode("2D")} className={`flex-1 py-2 text-sm font-medium rounded-xl ${viewMode==="2D" ? "bg-primary-600 text-white" : "bg-transparent text-neutral-600 border"}`}>Fashion Sketch</button>
            <button onClick={() => setViewMode("REAL")} className={`flex-1 py-2 text-sm font-medium rounded-xl ${viewMode==="REAL" ? "bg-primary-600 text-white" : "bg-transparent text-neutral-600 border"}`} disabled={!recommendation}>Real Look</button>
          </div>

          <div className="flex-1 flex items-center justify-center rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-dashed p-6">
            {viewMode === "2D" && isGenerating2D && !generatedImage2D && (
              <div className="text-center text-sm text-neutral-500">Generating fashion sketch…</div>
            )}

            {viewMode === "REAL" && !hasReal && (
              <button onClick={onGenerateReal} className="px-4 py-2 rounded-lg bg-primary-600 text-white">Generate Real Look</button>
            )}

            {activeImage ? (
              <img src={activeImage} alt={viewMode==="2D" ? "Fashion Sketch" : "Real Look"} className="w-full max-w-[520px] max-h-[520px] object-contain rounded-xl shadow-md" />
            ) : (
              !isGenerating2D && viewMode === "2D" && <div className="text-center text-sm text-neutral-500">Click “Get My Look” to generate images.</div>
            )}
          </div>
        </div>

        {/* RIGHT column */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-neutral-900 border rounded-2xl p-4 shadow-sm">
            <div className="text-xs uppercase text-neutral-500 mb-1">Overall vibe</div>
            <div className="text-sm text-neutral-900 dark:text-neutral-50 mb-2">{recommendation.overallVibe}</div>
            <div className="text-xs text-neutral-600">Confidence tip: {recommendation.confidenceTip}</div>
          </div>

          <div className="bg-white dark:bg-neutral-900 border rounded-2xl p-4 shadow-sm space-y-3">
            <div className="text-xs uppercase text-neutral-500">Outfit breakdown</div>

            {(["top","bottom","shoes","accessory"] as const).map(slot => {
              const item = (recommendation as any)[slot];
              if (!item) return null;
              return (
                <div key={slot} className="flex items-start gap-3 text-sm border-b pb-3 last:pb-0">
                  <div className="w-20 text-xs font-semibold uppercase text-neutral-500">{slot}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neutral-900 dark:text-neutral-50">{item.color} {item.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full border text-neutral-500">{item.source === "Wardrobe" ? "From your wardrobe" : "Shopping suggestion"}</span>
                    </div>
                    <div className="text-xs text-neutral-600 mt-1">{item.description}</div>
                    <div className="text-[11px] text-neutral-500 mt-1">Why: {item.reasoning}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-white dark:bg-neutral-900 border rounded-2xl p-4 shadow-sm">
            <div className="text-xs uppercase text-neutral-500 mb-1">Hair & finishing</div>
            <div className="text-sm text-neutral-900 dark:text-neutral-50">{recommendation.hairstyle}</div>
            <div className="text-xs text-neutral-600 mt-1">{recommendation.hairstyleReasoning}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultDisplay;

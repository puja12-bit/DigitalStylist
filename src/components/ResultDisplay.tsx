// src/components/ResultDisplay.tsx
import React, { useState } from "react";
import { UserProfile, OutfitRecommendation } from "../types";

type Props = {
  profile: UserProfile;
  recommendation: OutfitRecommendation | null;
  occasion?: string;
  generatedImage: string | null;
  generatedImageReal: string | null;
  isGenerating2D: boolean;
  onGenerateReal: () => void;
  onBack: () => void;
};

const ResultDisplay: React.FC<Props> = ({
  profile,
  recommendation,
  occasion,
  generatedImage,
  generatedImageReal,
  isGenerating2D,
  onGenerateReal,
  onBack,
}) => {
  const [viewMode, setViewMode] = useState<"2D" | "REAL">("2D");
  const [isGeneratingReal, setIsGeneratingReal] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  if (!recommendation) {
    return (
      <div className="min-h-[calc(100vh-4rem)] w-full max-w-6xl mx-auto px-4 py-6 sm:py-10">
        <div className="mb-6 flex items-center justify-between">
          <button onClick={onBack} className="inline-flex items-center gap-2 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white">
            <span className="text-lg">←</span>
            Back to styling
          </button>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">For</div>
            <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{occasion || "Your occasion"}</div>
          </div>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-md border border-neutral-200 dark:border-neutral-800 p-6">
          <div className="text-center py-20 text-neutral-500 dark:text-neutral-400">
            <div className="text-lg font-medium mb-2">No recommendation yet</div>
            <div className="mb-4">Please click “Get My Look” or wait for the recommendation to appear.</div>
            <button onClick={onBack} className="px-4 py-2 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">Back</button>
          </div>
        </div>
      </div>
    );
  }

  const activeImage = viewMode === "2D" ? generatedImage : generatedImageReal;
  const hasReal = Boolean(generatedImageReal);

  const handleGenerateReal = async () => {
    setImageError(null);
    setIsGeneratingReal(true);
    try {
      await onGenerateReal();
    } catch (err: any) {
      setImageError(err?.message || "Failed to generate real image");
    } finally {
      setIsGeneratingReal(false);
    }
  };

  const top = recommendation.top ?? null;
  const bottom = recommendation.bottom ?? null;
  const shoes = recommendation.shoes ?? null;
  const accessory = recommendation.accessory ?? null;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1 bg-white dark:bg-neutral-900 p-6 rounded-2xl shadow-lg border border-neutral-100 dark:border-neutral-800">
          <div className="flex justify-between items-start gap-4">
            <div>
              <h2 className="text-2xl font-serif mb-1">Your Look for <span className="text-primary-600">{occasion || "the occasion"}</span></h2>
              <p className="text-neutral-500 dark:text-neutral-400">Confidence tip: <span className="font-medium text-neutral-700 dark:text-neutral-200">{recommendation.confidenceTip || "—"}</span></p>
            </div>
            <div className="text-right">
              <div className="text-sm text-neutral-900 dark:text-neutral-50">{recommendation.overallVibe}</div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">{recommendation.hairstyle}</div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Top</h3>
              <p className="text-neutral-700 dark:text-neutral-100">{top?.name ?? "—"}</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{top?.description ?? ""}</p>

              <h3 className="text-lg font-medium mt-4">Bottom</h3>
              <p className="text-neutral-700 dark:text-neutral-100">{bottom?.name ?? "—"}</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{bottom?.description ?? ""}</p>

              <h3 className="text-lg font-medium mt-4">Shoes & Accessory</h3>
              <p className="text-neutral-700 dark:text-neutral-100">{shoes?.name ?? "—"} {shoes?.description ? `— ${shoes.description}` : ""}</p>
              <p className="text-neutral-700 dark:text-neutral-100">{accessory?.name ?? "—"} {accessory?.description ? `— ${accessory.description}` : ""}</p>
            </div>

            <div className="space-y-4">
              <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-3 min-h-[220px] flex items-center justify-center">
                {isGenerating2D ? (
                  <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <div className="text-sm text-neutral-500">Generating fashion sketch…</div>
                  </div>
                ) : generatedImage ? (
                  <img src={generatedImage} alt="2D fashion sketch" className="max-h-72 object-contain mx-auto" />
                ) : (
                  <div className="text-neutral-400">No fashion sketch yet</div>
                )}
              </div>

              <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-3 min-h-[220px] flex items-center justify-center">
                {isGeneratingReal || isGenerating2D ? (
                  <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <div className="text-sm text-neutral-500">{isGeneratingReal ? "Generating real look…" : "Preparing real look…"}</div>
                  </div>
                ) : generatedImageReal ? (
                  <img src={generatedImageReal} alt="Real look" className="max-h-72 object-contain mx-auto" />
                ) : (
                  <div className="text-neutral-400">No real look yet</div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button onClick={handleGenerateReal} disabled={isGeneratingReal || !!generatedImageReal} className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-60">
              {isGeneratingReal ? "Generating real look…" : generatedImageReal ? "Real look ready" : "Generate real look"}
            </button>

            <button onClick={onBack} className="px-4 py-2 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
              Start Over
            </button>
          </div>

          {imageError && <div className="mt-4 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded">{imageError}</div>}
        </div>
      </div>
    </div>
  );
};

export default ResultDisplay;

import React from "react";
import {
  UserProfile,
  OutfitRecommendation,
} from "../types";

type Props = {
  profile: UserProfile;
  recommendation: OutfitRecommendation;
  generatedImage: string | null;
  generatedImageReal: string | null;
  isGenerating2D: boolean;
  onGenerateReal: () => void;
  onBack: () => void;
};

const ResultDisplay: React.FC<Props> = ({
  profile,
  recommendation,
  generatedImage,
  generatedImageReal,
  isGenerating2D,
  onGenerateReal,
  onBack,
}) => {
  const [viewMode, setViewMode] = React.useState<"2D" | "REAL">("2D");

  const activeImage =
    viewMode === "2D" ? generatedImage : generatedImageReal;

  const hasReal = Boolean(generatedImageReal);

  return (
    <div className="min-h-[calc(100vh-4rem)] w-full max-w-6xl mx-auto px-4 py-6 sm:py-10">
      {/* Top controls */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white"
        >
          <span className="text-lg">←</span>
          Back to styling
        </button>

        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            For
          </div>
          <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            {recommendation.occasion || "Your occasion"}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-6 lg:gap-8 items-start">
        {/* LEFT: Big image + tabs */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-md border border-neutral-200 dark:border-neutral-800 p-4 sm:p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4 gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Visual preview
              </div>
              <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                {profile.name || "Your look"}
              </div>
            </div>

            <div className="inline-flex text-xs rounded-full border border-neutral-200 dark:border-neutral-700 px-3 py-1 text-neutral-600 dark:text-neutral-300">
              {profile.gender || "Gender?"} • {profile.skinTone || "Skin tone?"}
            </div>
          </div>

          {/* Mode tabs */}
          <div className="flex items-center gap-2 mb-4">
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-xl border transition-colors ${
                viewMode === "2D"
                  ? "bg-primary-600 text-white border-primary-600"
                  : "bg-transparent text-neutral-600 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700"
              }`}
              onClick={() => setViewMode("2D")}
            >
              Fashion Sketch
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-xl border transition-colors ${
                viewMode === "REAL"
                  ? "bg-primary-600 text-white border-primary-600"
                  : "bg-transparent text-neutral-600 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700"
              }`}
              onClick={() => setViewMode("REAL")}
              disabled={!recommendation}
            >
              Real Look
            </button>
          </div>

          {/* Image container */}
          <div className="flex-1 flex items-center justify-center rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-dashed border-neutral-200 dark:border-neutral-800 px-3 py-4 sm:px-6 sm:py-6">
            {viewMode === "2D" && isGenerating2D && !generatedImage && (
              <div className="text-center text-sm text-neutral-500 dark:text-neutral-400">
                Generating fashion sketch…
              </div>
            )}

            {viewMode === "REAL" && !hasReal && (
              <button
                onClick={onGenerateReal}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 shadow-sm"
              >
                Generate Real Look
              </button>
            )}

            {activeImage && (
              <img
                src={activeImage}
                alt={
                  viewMode === "2D"
                    ? "Fashion Sketch"
                    : "Real Look"
                }
                className="w-full max-w-[520px] max-h-[520px] h-auto object-contain rounded-xl shadow-md"
              />
            )}

            {!activeImage && !isGenerating2D && viewMode === "2D" && (
              <div className="text-center text-sm text-neutral-500 dark:text-neutral-400">
                Click “Generate Look” again if nothing appears.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Outfit breakdown */}
        <div className="space-y-4 sm:space-y-5">
          {/* Overall vibe */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1">
              Overall vibe
            </div>
            <div className="text-sm text-neutral-900 dark:text-neutral-50 mb-2">
              {recommendation.overallVibe}
            </div>
            <div className="text-xs text-neutral-600 dark:text-neutral-300">
              Confidence tip: {recommendation.confidenceTip}
            </div>
          </div>

          {/* Outfit items */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Outfit breakdown
            </div>

            {(["top", "bottom", "shoes", "accessory"] as const).map((slot) => {
              const item = (recommendation as any)[slot];
              if (!item) return null;

              return (
                <div
                  key={slot}
                  className="flex items-start gap-3 text-sm border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 pb-3 last:pb-0"
                >
                  <div className="w-20 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400 shrink-0">
                    {slot}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neutral-900 dark:text-neutral-50">
                        {item.color} {item.name}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400">
                        {item.source === "Wardrobe"
                          ? "From your wardrobe"
                          : "Shopping suggestion"}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-600 dark:text-neutral-300 mt-0.5">
                      {item.description}
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                      Why: {item.reasoning}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hair */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1">
              Hair & finishing
            </div>
            <div className="text-sm text-neutral-900 dark:text-neutral-50">
              {recommendation.hairstyle}
            </div>
            <div className="text-xs text-neutral-600 dark:text-neutral-300 mt-1">
              {recommendation.hairstyleReasoning}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultDisplay;

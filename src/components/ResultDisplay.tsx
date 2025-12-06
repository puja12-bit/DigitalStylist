import React, { useState } from "react";
import { OutfitRecommendation, RecommendedItem } from "../types";

interface Props {
  result: OutfitRecommendation;
  generatedImage2D: string | null;
  generatedImageReal: string | null;
  isGenerating2D: boolean;
  onReset: () => void;
  onGenerateReal: () => void;
}

const ItemCard: React.FC<{
  item: RecommendedItem;
  type: string;
  isShopping?: boolean;
}> = ({ item, type, isShopping }) => {
  const searchUrl = (site: string) => {
    const query = encodeURIComponent(`${item.color} ${item.name} ${type}`);
    if (site === "amazon") return `https://www.amazon.com/s?k=${query}`;
    if (site === "myntra")
      return `https://www.myntra.com/${query.replace(/%20/g, "-")}`;
    if (site === "ajio") return `https://www.ajio.com/search/?text=${query}`;
    return "#";
  };

  // 🔹 Avoid "Mauve Mauve ..." when the name already starts with the color
  const displayName = item.name
    ? item.name.toLowerCase().startsWith(item.color?.toLowerCase() || "")
      ? item.name
      : `${item.color} ${item.name}`
    : item.color || "";

  return (
    <div className="rounded-2xl bg-neutral-900/40 border border-neutral-700/60 p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-neutral-400">
        <span>{type}</span>
        {isShopping ? (
          <span className="px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-300 border border-primary-500/30">
            Shopping
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
            Wardrobe
          </span>
        )}
      </div>

      <h3 className="text-sm font-semibold text-neutral-50">{displayName}</h3>

      <p className="text-xs text-neutral-300 leading-relaxed">
        {item.description}
      </p>

      {/* Reasoning bubble */}
      {item.reasoning && (
        <div className="mt-1 text-xs italic text-neutral-300 bg-neutral-900/80 border border-neutral-700/70 rounded-xl px-3 py-2">
          “{item.reasoning}”
        </div>
      )}

      {isShopping && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="text-neutral-400">Buy online:</span>
          <a
            href={searchUrl("amazon")}
            target="_blank"
            rel="noreferrer"
            className="underline text-primary-300 hover:text-primary-200"
          >
            Amazon
          </a>
          <a
            href={searchUrl("myntra")}
            target="_blank"
            rel="noreferrer"
            className="underline text-primary-300 hover:text-primary-200"
          >
            Myntra
          </a>
          <a
            href={searchUrl("ajio")}
            target="_blank"
            rel="noreferrer"
            className="underline text-primary-300 hover:text-primary-200"
          >
            Ajio
          </a>
        </div>
      )}
    </div>
  );
};

const ResultDisplay: React.FC<Props> = ({
  result,
  generatedImage2D,
  generatedImageReal,
  isGenerating2D,
  onReset,
  onGenerateReal,
}) => {
  const [viewMode, setViewMode] = useState<"2D" | "REAL">("2D");
  const [isGeneratingReal, setIsGeneratingReal] = useState(false);

  const handleModeChange = (mode: "2D" | "REAL") => {
    setViewMode(mode);
    if (mode === "REAL" && !generatedImageReal) {
      setIsGeneratingReal(true);
      setTimeout(() => onGenerateReal(), 100);
    }
  };

  const currentImage = viewMode === "2D" ? generatedImage2D : generatedImageReal;
  const isLoadingReal = viewMode === "REAL" && !generatedImageReal && isGeneratingReal;
  const isLoading2D = viewMode === "2D" && isGenerating2D;

  // Flatten outfit parts
  const allItems = [
    { ...result.top, type: "Top" },
    { ...result.bottom, type: "Bottom" },
    { ...result.shoes, type: "Shoes" },
    { ...result.accessory, type: "Accessory" },
  ];

  const shoppingItems = allItems.filter((i) => i.source === "Shopping");
  const wardrobeItems = allItems.filter((i) => i.source === "Wardrobe");

  return (
    <div className="mt-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)] gap-6 lg:gap-8">
      {/* 1. Header */}
      <div className="lg:col-span-2 flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-neutral-50">
          The Confidence Look
        </h2>
        <p className="text-sm text-neutral-300 italic">“{result.overallVibe}”</p>
        <p className="text-sm text-primary-200">
          ✨ {result.confidenceTip}
        </p>
      </div>

      {/* 2. Visual section */}
      <div className="rounded-3xl bg-neutral-900/60 border border-neutral-700/70 p-4 lg:p-5 flex flex-col gap-4">
        {/* Tabs */}
        <div className="flex gap-2 bg-neutral-900/60 rounded-2xl p-1">
          <button
            onClick={() => handleModeChange("2D")}
            className={`flex-1 py-2.5 text-xs font-semibold rounded-xl transition-all ${
              viewMode === "2D"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-400 hover:text-neutral-100"
            }`}
          >
            Fashion Sketch
          </button>
          <button
            onClick={() => handleModeChange("REAL")}
            className={`flex-1 py-2.5 text-xs font-semibold rounded-xl transition-all ${
              viewMode === "REAL"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-400 hover:text-neutral-100"
            }`}
          >
            Real Look
          </button>
        </div>

        {/* Image area */}
        <div className="flex-1 rounded-2xl border border-dashed border-neutral-700/70 bg-neutral-950/50 flex flex-col items-center justify-center px-4 py-6 text-center">
          {isLoadingReal ? (
            <>
              <h3 className="text-sm font-semibold text-neutral-50 mb-1">
                Generating Realism...
              </h3>
              <p className="text-xs text-neutral-300">
                Creating a 4K photorealistic render based on your profile.
              </p>
            </>
          ) : isLoading2D ? (
            <>
              <div className="text-2xl mb-1">✏️</div>
              <h3 className="text-sm font-semibold text-neutral-50 mb-1">
                Sketching Outfit...
              </h3>
              <p className="text-xs text-neutral-300">
                Our AI artist is drawing your look.
              </p>
            </>
          ) : currentImage ? (
            <img
              src={currentImage}
              alt={viewMode === "2D" ? "AI fashion sketch" : "AI real look"}
              className="max-h-80 w-auto rounded-2xl object-contain"
            />
          ) : (
            <>
              <div className="text-4xl mb-2">🖼️</div>
              <p className="text-xs text-neutral-400">
                Select a mode to view.
              </p>
            </>
          )}
        </div>

        {/* Mode badge + grooming */}
        <div className="flex flex-col gap-3">
          <span className="inline-flex self-start px-3 py-1 rounded-full bg-neutral-900/80 border border-neutral-700/60 text-[11px] uppercase tracking-wide text-neutral-400">
            {viewMode === "2D" ? "AI Sketch Mode" : "AI Realism Mode"}
          </span>

          <div>
            <h4 className="text-xs font-semibold text-neutral-200 mb-1">
              Grooming Advice
            </h4>
            <p className="text-xs text-neutral-200 mb-1">{result.hairstyle}</p>
            <p className="text-xs text-neutral-400">
              {result.hairstyleReasoning}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Details / items */}
      <div className="flex flex-col gap-5">
        {/* Wardrobe */}
        <section className="rounded-3xl bg-neutral-900/60 border border-neutral-700/70 p-4 lg:p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 text-xs">
              ✓
            </span>
            <h3 className="text-sm font-semibold text-neutral-50">
              From Your Wardrobe
            </h3>
          </div>

          {wardrobeItems.length > 0 ? (
            <div className="grid gap-3">
              {wardrobeItems.map((item, idx) => (
                <ItemCard
                  key={`${item.name}-${idx}-wardrobe`}
                  item={item}
                  type={item.type}
                  isShopping={false}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-neutral-400">
              No suitable items found in your wardrobe for this specific look.
            </p>
          )}
        </section>

        {/* Shopping */}
        {shoppingItems.length > 0 && (
          <section className="rounded-3xl bg-neutral-900/60 border border-neutral-700/70 p-4 lg:p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-500/15 text-primary-300 text-xs">
                🛍️
              </span>
            </div>
            <h3 className="text-sm font-semibold text-neutral-50">
              Shop The Look
            </h3>
            <p className="text-xs text-neutral-400">
              These items complete your outfit.
            </p>

            <div className="grid gap-3">
              {shoppingItems.map((item, idx) => (
                <ItemCard
                  key={`${item.name}-${idx}-shopping`}
                  item={item}
                  type={item.type}
                  isShopping
                />
              ))}
            </div>
          </section>
        )}

        {/* Reset */}
        <button
          type="button"
          onClick={onReset}
          className="mt-1 inline-flex items-center justify-center px-4 py-2.5 text-xs font-medium rounded-2xl border border-neutral-600 text-neutral-100 hover:bg-neutral-800 transition-colors"
        >
          Style Another Occasion
        </button>
      </div>
    </div>
  );
};

export default ResultDisplay;

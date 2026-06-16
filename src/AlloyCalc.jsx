import { useState, useMemo } from "react";

const METAL_COLORS = {
  copper: "#B87333",
  tin: "#A8A9AD",
  zinc: "#BAC4CB",
  bismuth: "#9A8878",
  silver: "#C0C0C0",
  gold: "#FFD700",
  iron: "#848484",
  nickel: "#727272",
  steel: "#707080",
  "pig iron": "#5A5A6A",
};

const FALLBACK_COLORS = ["#B87333", "#A8A9AD", "#BAC4CB", "#9A8878", "#C0C0C0", "#FFD700", "#848484", "#727272"];

const PRESET_ALLOYS = [
  { name: "Bronze", metals: [{ name: "Copper", min: 88, max: 92 }, { name: "Tin", min: 8, max: 12 }] },
  { name: "Bismuth Bronze", metals: [{ name: "Copper", min: 50, max: 65 }, { name: "Zinc", min: 20, max: 30 }, { name: "Bismuth", min: 10, max: 20 }] },
  { name: "Black Bronze", metals: [{ name: "Copper", min: 50, max: 70 }, { name: "Silver", min: 10, max: 25 }, { name: "Gold", min: 10, max: 25 }] },
  { name: "Brass", metals: [{ name: "Copper", min: 88, max: 92 }, { name: "Zinc", min: 8, max: 12 }] },
  { name: "Rose Gold", metals: [{ name: "Copper", min: 15, max: 30 }, { name: "Gold", min: 70, max: 85 }] },
  { name: "Sterling Silver", metals: [{ name: "Copper", min: 20, max: 40 }, { name: "Silver", min: 60, max: 80 }] },
];

function getMetalColor(name, index) {
  return METAL_COLORS[name.toLowerCase()] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function calculateAlloy(metals, desiredTotal, weights) {
  if (metals.length === 0 || desiredTotal <= 0) return null;
  if (metals.some(m => m.min > m.max || m.min < 0)) return null;

  const minSum = metals.reduce((a, m) => a + m.min, 0);
  const maxSum = metals.reduce((a, m) => a + m.max, 0);
  if (minSum > 100 || maxSum < 100) return { impossible: true, minSum, maxSum };

  const targetPcts = metals.map((m, i) => m.min + (m.max - m.min) * (weights[i] ?? 0.5));
  const sumTarget = targetPcts.reduce((a, b) => a + b, 0);
  if (sumTarget === 0) return null;

  const normalizedPcts = targetPcts.map(p => (p / sumTarget) * 100);
  const raw = normalizedPcts.map(p => (p / 100) * desiredTotal);

  let amounts = raw.map(r => Math.round(r / 5) * 5);
  let diff = desiredTotal - amounts.reduce((a, b) => a + b, 0);

  while (diff !== 0) {
    const step = diff > 0 ? 5 : -5;
    let bestIdx = -1;
    let bestDist = Infinity;

    for (let i = 0; i < amounts.length; i++) {
      const newAmount = amounts[i] + step;
      if (newAmount < 0) continue;
      const newPct = (newAmount / desiredTotal) * 100;
      const inRange = newPct >= metals[i].min - 0.001 && newPct <= metals[i].max + 0.001;
      if (!inRange) continue;
      const dist = Math.abs(newPct - normalizedPcts[i]);
      if (dist < bestDist) { bestDist = dist; bestIdx = i; }
    }

    if (bestIdx === -1) {
      for (let i = 0; i < amounts.length; i++) {
        const newAmount = amounts[i] + step;
        if (newAmount < 0) continue;
        const dist = Math.abs((newAmount / desiredTotal) * 100 - normalizedPcts[i]);
        if (dist < bestDist) { bestDist = dist; bestIdx = i; }
      }
    }

    if (bestIdx === -1) break;
    amounts[bestIdx] += step;
    diff -= step;
  }

  const actualPcts = amounts.map(a => (a / desiredTotal) * 100);
  const valid = metals.every((m, i) => actualPcts[i] >= m.min - 0.001 && actualPcts[i] <= m.max + 0.001);

  const ranges = metals.map(m => ({
    minAmount: Math.ceil(desiredTotal * m.min / 100 / 5) * 5,
    maxAmount: Math.floor(desiredTotal * m.max / 100 / 5) * 5,
  }));

  return { amounts, actualPcts, valid, ranges };
}

export default function AlloyCalc() {
  const [metals, setMetals] = useState([
    { name: "Copper", min: 88, max: 92 },
    { name: "Zinc", min: 8, max: 12 },
  ]);
  const [desiredTotal, setDesiredTotal] = useState(100);
  const [alloyName, setAlloyName] = useState("Brass");
  const [weights, setWeights] = useState([0.5, 0.5]);

  const result = useMemo(() => calculateAlloy(metals, desiredTotal, weights), [metals, desiredTotal, weights]);

  const loadPreset = (preset) => {
    setMetals(preset.metals.map(m => ({ ...m })));
    setAlloyName(preset.name);
    setWeights(preset.metals.map(() => 0.5));
  };

  const updateMetal = (index, field, value) => {
    setMetals(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
    setAlloyName("Custom");
  };

  const addMetal = () => {
    setMetals(prev => [...prev, { name: "", min: 0, max: 0 }]);
    setWeights(prev => [...prev, 0.5]);
    setAlloyName("Custom");
  };

  const removeMetal = (index) => {
    setMetals(prev => prev.filter((_, i) => i !== index));
    setWeights(prev => prev.filter((_, i) => i !== index));
    setAlloyName("Custom");
  };

  const setWeight = (index, value) => {
    setWeights(prev => prev.map((w, i) => i === index ? value : w));
  };

  const setTotal = (val) => {
    const snapped = Math.round(Math.max(5, val) / 5) * 5;
    setDesiredTotal(snapped);
  };

  const P = { background: "#2d2d2d", boxShadow: "inset 2px 2px 0 #4a4a4a, inset -2px -2px 0 #1a1a1a", border: "2px solid #111" };
  const btn = (bg, fg) => ({ background: bg, color: fg, boxShadow: "inset 2px 2px 0 rgba(255,255,255,0.12), inset -2px -2px 0 rgba(0,0,0,0.25)", border: "2px solid #111" });
  const inp = { background: "#1a1a16", color: "#ddd", boxShadow: "inset 1px 1px 0 #0d0d0a, inset -1px -1px 0 #333", border: "1px solid #111" };

  const ingots = desiredTotal / 100;

  return (
    <>
      {/* Preset Alloys */}
      <div className="mb-2 rounded p-2" style={P}>
        <span className="text-xs font-bold block mb-1.5" style={{ color: "#999" }}>PRESET ALLOYS</span>
        <div className="flex gap-1 flex-wrap">
          {PRESET_ALLOYS.map(preset => (
            <button key={preset.name} onClick={() => loadPreset(preset)}
              className="text-xs px-2 py-1 rounded font-bold cursor-pointer"
              style={{
                ...btn(alloyName === preset.name ? "#3a4a2d" : "#2d2d2d", alloyName === preset.name ? "#88ff88" : "#aaa"),
                border: alloyName === preset.name ? "2px solid #4a7a3a" : "2px solid #111",
              }}>
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Metal Components */}
      <div className="mb-2 rounded p-2" style={P}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold" style={{ color: "#999" }}>COMPONENTS</span>
          <button onClick={addMetal} className="text-xs px-2 py-0.5 rounded font-bold cursor-pointer" style={btn("#2d4a2d", "#6fc66f")}>+ Add</button>
        </div>
        <div className="flex flex-col gap-1.5">
          {metals.map((metal, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="w-2 h-8 rounded-sm flex-shrink-0" style={{ background: getMetalColor(metal.name, i) }} />
              <input value={metal.name} onChange={e => updateMetal(i, "name", e.target.value)}
                placeholder="Metal name"
                className="flex-1 min-w-0 rounded px-2 py-1 text-xs font-bold" style={inp} />
              <input type="number" value={metal.min} onChange={e => updateMetal(i, "min", parseFloat(e.target.value) || 0)}
                className="w-12 text-center text-xs font-bold rounded px-1 py-1" style={inp} />
              <span className="text-[10px] flex-shrink-0" style={{ color: "#666" }}>–</span>
              <input type="number" value={metal.max} onChange={e => updateMetal(i, "max", parseFloat(e.target.value) || 0)}
                className="w-12 text-center text-xs font-bold rounded px-1 py-1" style={inp} />
              <span className="text-[10px] flex-shrink-0" style={{ color: "#666" }}>%</span>
              {metals.length > 1 && (
                <button onClick={() => removeMetal(i)} className="text-xs px-1 cursor-pointer flex-shrink-0" style={{ color: "#f87171" }}>✕</button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-1.5 text-[10px] flex gap-3" style={{ color: "#666" }}>
          <span>Min sum: <span style={{ color: metals.reduce((a, m) => a + m.min, 0) > 100 ? "#f87171" : "#666" }}>{metals.reduce((a, m) => a + m.min, 0)}%</span></span>
          <span>Max sum: <span style={{ color: metals.reduce((a, m) => a + m.max, 0) < 100 ? "#f87171" : "#666" }}>{metals.reduce((a, m) => a + m.max, 0)}%</span></span>
        </div>
      </div>

      {/* Desired Total */}
      <div className="mb-2 rounded p-2" style={P}>
        <span className="text-xs font-bold block mb-1.5" style={{ color: "#999" }}>DESIRED OUTPUT</span>
        <div className="flex items-center gap-2">
          <input type="number" step={5} value={desiredTotal}
            onChange={e => setTotal(parseInt(e.target.value) || 5)}
            className="w-20 text-center text-sm font-bold rounded px-2 py-1" style={inp} />
          <span className="text-xs" style={{ color: "#888" }}>mB = {ingots % 1 === 0 ? ingots : ingots.toFixed(1)} ingot{ingots !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex gap-1 mt-1.5">
          {[1, 2, 3, 4, 5, 10].map(n => (
            <button key={n} onClick={() => setDesiredTotal(n * 100)}
              className="text-xs px-2 py-1 rounded font-bold cursor-pointer"
              style={btn(desiredTotal === n * 100 ? "#3a4a2d" : "#2d2d2d", desiredTotal === n * 100 ? "#88ff88" : "#aaa")}>
              {n}
            </button>
          ))}
          <span className="text-[10px] self-center ml-1" style={{ color: "#666" }}>ingots</span>
        </div>
      </div>

      {/* Results */}
      <div className="rounded p-2" style={{
        background: result?.valid ? "#1d2d1a" : "#2d1a1a",
        boxShadow: `inset 2px 2px 0 ${result?.valid ? "#2a4a2a" : "#4a2a2a"}, inset -2px -2px 0 #111`,
        border: "2px solid #111",
      }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold" style={{ color: "#999" }}>
            {alloyName && alloyName !== "Custom" ? `${alloyName.toUpperCase()} RECIPE` : "RECIPE"}
          </span>
          {result && !result.impossible && (
            <span className="text-xs font-bold" style={{ color: result.valid ? "#4ade80" : "#f87171" }}>
              {result.valid ? "✓ Valid" : "✕ Out of range"}
            </span>
          )}
        </div>

        {result?.impossible ? (
          <p className="text-xs" style={{ color: "#f87171" }}>
            Impossible range — min sum ({result.minSum}%) {result.minSum > 100 ? "exceeds" : "and max sum (" + result.maxSum + "%) don't span"} 100%.
          </p>
        ) : result ? (
          <div className="flex flex-col gap-2.5">
            {metals.map((metal, i) => {
              const amount = result.amounts[i];
              const pct = result.actualPcts[i];
              const inRange = pct >= metal.min - 0.001 && pct <= metal.max + 0.001;
              const color = getMetalColor(metal.name, i);
              const range = result.ranges[i];
              return (
                <div key={i}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="font-bold flex items-center gap-1.5">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                      {metal.name || `Metal ${i + 1}`}
                    </span>
                    <span>
                      <span className="font-bold" style={{ color: inRange ? "#e8b849" : "#f87171" }}>{amount} mB</span>
                      <span style={{ color: "#666" }}> ({pct.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="relative h-3 rounded overflow-hidden" style={{ background: "#1a1a16", boxShadow: "inset 1px 1px 0 #0d0d0d" }}>
                    <div className="absolute top-0 h-full" style={{
                      left: `${metal.min}%`, width: `${metal.max - metal.min}%`,
                      background: "rgba(255,255,255,0.06)",
                      borderLeft: "1px solid rgba(255,255,255,0.2)",
                      borderRight: "1px solid rgba(255,255,255,0.2)",
                    }} />
                    <div className="absolute top-0 h-full rounded-r" style={{
                      width: `${Math.min(pct, 100)}%`, background: color, opacity: 0.7,
                    }} />
                  </div>
                  <div className="flex justify-between text-[10px] mt-0.5" style={{ color: "#555" }}>
                    <span>{metal.min}% ({range.minAmount} mB)</span>
                    <span>{metal.max}% ({range.maxAmount} mB)</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[9px] flex-shrink-0" style={{ color: "#555" }}>less</span>
                    <input type="range" min="0" max="100" value={Math.round(weights[i] * 100)}
                      onChange={e => setWeight(i, parseInt(e.target.value) / 100)}
                      className="alloy-slider flex-1" />
                    <span className="text-[9px] flex-shrink-0" style={{ color: "#555" }}>more</span>
                  </div>
                </div>
              );
            })}
            <div className="flex items-center justify-between text-xs pt-1.5" style={{ borderTop: "1px solid #333" }}>
              <span className="font-bold" style={{ color: "#999" }}>Total</span>
              <span className="font-bold" style={{ color: "#e8b849" }}>{desiredTotal} mB ({ingots % 1 === 0 ? ingots : ingots.toFixed(1)} ingot{ingots !== 1 ? "s" : ""})</span>
            </div>
          </div>
        ) : (
          <p className="text-xs" style={{ color: "#a88" }}>Add metals with valid percentage ranges to calculate.</p>
        )}
      </div>

      {/* Info */}
      <details className="mt-3">
        <summary className="text-xs cursor-pointer font-bold" style={{ color: "#7a7a6a" }}>How It Works</summary>
        <div className="mt-1 rounded p-2 text-xs" style={{ ...P, color: "#888", lineHeight: 1.5 }}>
          <p className="mb-1">Enter each metal's valid percentage range from the TFC alloy recipe. Set how many ingots you want (100 mB = 1 ingot).</p>
          <p className="mb-1">All amounts round to multiples of 5 mB. Use the <b style={{ color: "#aaa" }}>less/more</b> sliders to bias each metal toward the low or high end of its range — the others adjust to compensate.</p>
          <p>The colored bars show where your percentage falls within the valid range. Min/max mB values show the safe bounds (also in 5s).</p>
        </div>
      </details>
    </>
  );
}

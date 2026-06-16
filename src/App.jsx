import { useState, useEffect, useMemo, useRef } from "react";

// ─── Step definitions ───
const STEPS = {
  draw:         { value: -15, label: "Draw",       color: "red" },
  "hard-hit":   { value: -9,  label: "Hard Hit",   color: "red" },
  "medium-hit": { value: -6,  label: "Medium Hit",  color: "red" },
  "light-hit":  { value: -3,  label: "Light Hit",   color: "red" },
  punch:        { value: 2,   label: "Punch",      color: "green" },
  bend:         { value: 7,   label: "Bend",       color: "green" },
  upset:        { value: 13,  label: "Upset",       color: "green" },
  shrink:       { value: 16,  label: "Shrink",      color: "green" },
};

const HIT_TYPES = ["light-hit", "medium-hit", "hard-hit"];
const ALL_STEP_KEYS = Object.keys(STEPS);
const STEP_TYPES = ["hit", "draw", "punch", "bend", "upset", "shrink"];
const ORDER_TYPES = ["last", "second_last", "third_last", "not_last", "any"];
const ORDER_LABELS = { last: "Last", second_last: "2nd Last", third_last: "3rd Last", not_last: "Not Last", any: "Any" };
const STEP_LABELS = { hit: "Hit", draw: "Draw", punch: "Punch", bend: "Bend", upset: "Upset", shrink: "Shrink" };

function parseRule(ruleStr) {
  const parts = ruleStr.split("_");
  return { step: parts[0], order: parts.slice(1).join("_") };
}

// ─── localStorage helpers ───
function loadRecipes() {
  try {
    const raw = localStorage.getItem("tfc-custom-recipes");
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveRecipes(recipes) {
  try { localStorage.setItem("tfc-custom-recipes", JSON.stringify(recipes)); } catch {}
}

// ─── BFS Solver ───
function bfs(start, stepValues, min = 0, max = 150) {
  const dist = new Int16Array(max + 1).fill(-1);
  const prev = new Int16Array(max + 1).fill(-1);
  const prevStep = new Int8Array(max + 1).fill(-1);
  dist[start] = 0;
  const queue = [start];
  let head = 0;
  while (head < queue.length) {
    const pos = queue[head++];
    for (let si = 0; si < stepValues.length; si++) {
      const next = pos + stepValues[si];
      if (next >= min && next <= max && dist[next] === -1) {
        dist[next] = dist[pos] + 1;
        prev[next] = pos;
        prevStep[next] = si;
        queue.push(next);
      }
    }
  }
  return { dist, prev, prevStep };
}

function reconstructPath(target, prev, prevStep, stepKeys) {
  const path = [];
  let pos = target;
  while (prev[pos] !== -1 && prev[pos] !== pos) {
    path.unshift(stepKeys[prevStep[pos]]);
    pos = prev[pos];
  }
  return path;
}

function endingSatisfiesRules(ending, rules) {
  const matched = new Set();
  for (const rule of rules) {
    const { step, order } = rule;
    let found = false;
    const matchesStep = (sk) => step === "hit" ? HIT_TYPES.includes(sk) : sk === step;

    if (order === "last") {
      if (ending[2] && matchesStep(ending[2]) && !matched.has(2)) { matched.add(2); found = true; }
    } else if (order === "second_last") {
      if (ending[1] && matchesStep(ending[1]) && !matched.has(1)) { matched.add(1); found = true; }
    } else if (order === "third_last") {
      if (ending[0] && matchesStep(ending[0]) && !matched.has(0)) { matched.add(0); found = true; }
    } else if (order === "not_last") {
      for (let i = 0; i < 2; i++) {
        if (ending[i] && matchesStep(ending[i]) && !matched.has(i)) { matched.add(i); found = true; break; }
      }
    } else if (order === "any") {
      for (let i = 0; i < 3; i++) {
        if (ending[i] && matchesStep(ending[i]) && !matched.has(i)) { matched.add(i); found = true; break; }
      }
    }
    if (!found) return false;
  }
  return true;
}

function generateValidEndings(rules) {
  const results = [];
  function* gen(d, buf) {
    if (d === 3) { if (endingSatisfiesRules(buf, rules)) yield [...buf]; return; }
    for (const key of ALL_STEP_KEYS) { buf[d] = key; yield* gen(d + 1, buf); }
  }
  for (const e of gen(0, [null, null, null])) results.push(e);
  return results;
}

function solve(greenPos, redPos, rules) {
  if (greenPos === redPos && rules.length === 0) return { steps: [], totalSteps: 0 };
  const stepKeys = ALL_STEP_KEYS;
  const stepValues = stepKeys.map(k => STEPS[k].value);
  const { dist, prev, prevStep } = bfs(greenPos, stepValues);

  if (rules.length === 0) {
    if (dist[redPos] === -1) return null;
    return { steps: reconstructPath(redPos, prev, prevStep, stepKeys), totalSteps: dist[redPos] };
  }

  const validEndings = generateValidEndings(rules);
  let bestResult = null;
  let bestLen = Infinity;

  for (const ending of validEndings) {
    const endSteps = [];
    let checkPos = redPos;
    for (let i = 2; i >= 0; i--) {
      checkPos -= STEPS[ending[i]].value;
      endSteps.unshift(ending[i]);
    }
    if (checkPos < 0 || checkPos > 150 || dist[checkPos] === -1) continue;
    let pos = checkPos, oob = false;
    for (let i = 0; i < 3; i++) { pos += STEPS[ending[i]].value; if (pos < 0 || pos > 150) { oob = true; break; } }
    if (oob) continue;
    const totalLen = dist[checkPos] + 3;
    if (totalLen < bestLen) {
      bestLen = totalLen;
      bestResult = { steps: [...reconstructPath(checkPos, prev, prevStep, stepKeys), ...endSteps], totalSteps: totalLen };
    }
  }
  return bestResult;
}

// ─── Step icon ───
function StepIcon({ type, size = 20 }) {
  return <img src={`/assets/${type}.png`} alt={type} width={size} height={size} style={{ imageRendering: "pixelated" }} />;
}

// ─── Rule badge ───
function RuleBadge({ rule, onRemove }) {
  const { step, order } = typeof rule === "string" ? parseRule(rule) : rule;
  const isRed = ["draw", "hard-hit", "medium-hit", "light-hit", "hit"].includes(step);
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold"
      style={{ background: "#3a3a3a", border: "1px solid #555", color: "#e0e0e0" }}>
      <StepIcon type={step} size={14} />
      <span style={{ color: isRed ? "#f87171" : "#4ade80" }}>{STEP_LABELS[step] || step}</span>
      <span style={{ color: "#999" }}>{ORDER_LABELS[order] || order}</span>
      {onRemove && <button onClick={onRemove} className="ml-1 hover:text-red-300 cursor-pointer" style={{ color: "#f87171", lineHeight: 1 }}>×</button>}
    </div>
  );
}

// ─── Progress bar ───
function ProgressBar({ green, red, onGreenChange, onRedChange }) {
  const barRef = useRef(null);
  const draggingRef = useRef(null);
  const posToX = (p) => (p / 150) * 100;

  useEffect(() => {
    const handleMove = (e) => {
      const pt = e.touches ? e.touches[0] : e;
      if (!draggingRef.current || !barRef.current) return;
      const rect = barRef.current.getBoundingClientRect();
      const pos = Math.round(Math.max(0, Math.min(1, (pt.clientX - rect.left) / rect.width)) * 150);
      if (draggingRef.current === "green") onGreenChange(pos);
      else onRedChange(pos);
    };
    const handleUp = () => { draggingRef.current = null; };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove, { passive: true });
    window.addEventListener("touchend", handleUp);
    return () => { window.removeEventListener("mousemove", handleMove); window.removeEventListener("mouseup", handleUp); window.removeEventListener("touchmove", handleMove); window.removeEventListener("touchend", handleUp); };
  }, [onGreenChange, onRedChange]);

  const startDrag = (which) => (e) => { e.preventDefault(); draggingRef.current = which; };

  return (
    <div className="relative select-none" style={{ padding: "14px 0 4px" }}>
      <div ref={barRef} className="relative h-6 rounded"
        style={{ background: "#1a1a16", boxShadow: "inset 2px 2px 0 #0d0d0a, inset -2px -2px 0 #3a3a30", border: "2px solid #111", cursor: "pointer" }}
        onClick={(e) => {
          const rect = barRef.current.getBoundingClientRect();
          const pos = Math.round(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * 150);
          if (Math.abs(pos - green) < Math.abs(pos - red)) onGreenChange(pos); else onRedChange(pos);
        }}>
        {Array.from({ length: 16 }, (_, i) => (
          <div key={i} className="absolute top-0 h-full" style={{ left: `${(i * 10 / 150) * 100}%`, width: 1, background: "rgba(255,255,255,0.08)" }} />
        ))}
        <div className="absolute top-0 h-full" style={{ left: `${posToX(red)}%`, transform: "translateX(-50%)", width: 8, cursor: "ew-resize", background: "#dc2626", borderRadius: 2, border: "1px solid #fff", zIndex: 2 }}
          onMouseDown={startDrag("red")} onTouchStart={startDrag("red")}>
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold whitespace-nowrap" style={{ color: "#f87171" }}>{red}</div>
        </div>
        <div className="absolute top-0 h-full" style={{ left: `${posToX(green)}%`, transform: "translateX(-50%)", width: 8, cursor: "ew-resize", background: "#16a34a", borderRadius: 2, border: "1px solid #fff", zIndex: 3 }}
          onMouseDown={startDrag("green")} onTouchStart={startDrag("green")}>
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold whitespace-nowrap" style={{ color: "#4ade80" }}>{green}</div>
        </div>
      </div>
      <div className="flex justify-between mt-1 text-[10px]" style={{ color: "#555" }}><span>0</span><span>50</span><span>100</span><span>150</span></div>
    </div>
  );
}

// ─── Main App ───
export default function App() {
  const [green, setGreen] = useState(0);
  const [red, setRed] = useState(75);
  const [rules, setRules] = useState([]);
  const [performedSteps, setPerformedSteps] = useState([]);
  const [recipeName, setRecipeName] = useState("");
  const [customRecipes, setCustomRecipes] = useState(() => loadRecipes());
  const [activeSlot, setActiveSlot] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [importStr, setImportStr] = useState("");
  const [copied, setCopied] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveCategory, setSaveCategory] = useState("");
  const [showRecipes, setShowRecipes] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState(new Set());

  const persistRecipes = (recipes) => {
    setCustomRecipes(recipes);
    saveRecipes(recipes);
  };

  const solution = useMemo(() => solve(green, red, rules.map(r => parseRule(r))), [green, red, rules]);

  const solutionTable = useMemo(() => {
    if (!solution || !solution.steps.length) return [];
    let pos = green;
    return solution.steps.map((s, i) => {
      const v = STEPS[s].value;
      const from = pos;
      pos += v;
      return { idx: i + 1, key: s, label: STEPS[s].label, value: v, from, to: pos, isEnding: i >= solution.steps.length - 3 };
    });
  }, [solution, green]);

  const loadRecipeFromList = (recipe) => {
    setRules([...recipe.rules]);
    if (recipe.green != null) setGreen(recipe.green);
    if (recipe.red != null) setRed(recipe.red);
    setRecipeName(recipe.name);
    setShowRecipes(false);
    setPerformedSteps([]);
    setActiveSlot(null);
  };

  const SLOT_POSITIONS = ["last", "second_last", "third_last"];

  const getSlotStep = (pos) => {
    const rule = rules.find(r => parseRule(r).order === pos);
    return rule ? parseRule(rule).step : null;
  };

  const setSlot = (pos, step) => {
    const filtered = rules.filter(r => parseRule(r).order !== pos);
    if (step) setRules([...filtered, `${step}_${pos}`]);
    else setRules(filtered);
    setActiveSlot(null);
  };

  const clearSlot = (pos) => {
    setRules(rules.filter(r => parseRule(r).order !== pos));
  };

  const exportRecipes = async () => {
    await navigator.clipboard.writeText(btoa(JSON.stringify(customRecipes)));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const importRecipesFromStr = (str) => {
    try {
      const data = JSON.parse(atob(str.trim()));
      if (Array.isArray(data)) {
        persistRecipes([...customRecipes, ...data]);
        setShowImport(false);
        setImportStr("");
      }
    } catch {}
  };

  const existingCategories = [...new Set(customRecipes.map(r => r.category).filter(Boolean))].sort();

  const recipeGroups = (() => {
    const cats = existingCategories;
    const groups = cats.map(cat => ({
      label: cat,
      items: customRecipes.map((r, i) => ({ ...r, _idx: i })).filter(r => r.category === cat),
    }));
    const uncategorized = customRecipes.map((r, i) => ({ ...r, _idx: i })).filter(r => !r.category);
    if (uncategorized.length > 0) {
      groups.push({ label: cats.length > 0 ? "Uncategorized" : "", items: uncategorized });
    }
    return groups;
  })();

  const saveCurrentRecipe = () => {
    if (!saveName.trim()) return;
    const recipe = { name: saveName.trim(), rules: [...rules], green, red };
    if (saveCategory.trim()) recipe.category = saveCategory.trim();
    persistRecipes([...customRecipes, recipe]);
    setSaveName(""); setSaveCategory(""); setShowSaveDialog(false);
  };

  const deleteCustomRecipe = (idx) => { persistRecipes(customRecipes.filter((_, i) => i !== idx)); };

  const performStep = (stepKey) => {
    const np = green + STEPS[stepKey].value;
    if (np < 0 || np > 150) return;
    setGreen(np);
    setPerformedSteps(prev => [...prev, stepKey]);
  };

  const reset = () => { setGreen(0); setPerformedSteps([]); };

  const undo = () => {
    if (performedSteps.length === 0) return;
    const lastStep = performedSteps[performedSteps.length - 1];
    setGreen(green - STEPS[lastStep].value);
    setPerformedSteps(prev => prev.slice(0, -1));
  };

  const checkSolved = () => {
    if (green !== red) return false;
    if (rules.length === 0) return true;
    const last3 = performedSteps.slice(-3);
    while (last3.length < 3) last3.unshift(null);
    return endingSatisfiesRules(last3, rules.map(r => parseRule(r)));
  };
  const isSolved = checkSolved();

  const P = { background: "#2d2d2d", boxShadow: "inset 2px 2px 0 #4a4a4a, inset -2px -2px 0 #1a1a1a", border: "2px solid #111" };
  const btn = (bg, fg) => ({ background: bg, color: fg, boxShadow: "inset 2px 2px 0 rgba(255,255,255,0.12), inset -2px -2px 0 rgba(0,0,0,0.25)", border: "2px solid #111" });

  return (
    <div className="min-h-screen p-3" style={{ background: "#181816", color: "#d4d4d4", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div className="max-w-xl mx-auto">

        <div className="text-center mb-3">
          <h1 className="text-2xl font-bold" style={{ color: "#e8b849", fontFamily: "'Silkscreen', cursive", textShadow: "2px 2px 0 #1a1a0a", letterSpacing: 2 }}>⚒ TFC Anvil</h1>
          <p className="text-xs mt-0.5" style={{ color: "#7a7a6a" }}>Add rules, set positions, get optimal steps</p>
        </div>

        {/* Saved Recipes */}
        <button onClick={() => setShowRecipes(!showRecipes)}
          className="w-full mb-2 py-1.5 px-3 rounded text-sm font-bold text-left flex items-center justify-between cursor-pointer"
          style={btn("#2d2d2d", "#d4d4d4")}>
          <span>{recipeName ? `📋 ${recipeName}` : `📋 My Recipes (${customRecipes.length})`}</span>
          <span className="text-xs" style={{ color: "#888" }}>{showRecipes ? "▲" : "▼"}</span>
        </button>

        {showRecipes && (
          <div className="mb-2 rounded overflow-hidden" style={P}>
            <div className="p-2 max-h-52 overflow-y-auto">
              {customRecipes.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: "#555" }}>No saved recipes. Set positions and rules, then hit 💾 Save.</p>
              ) : recipeGroups.map(group => {
                const isCollapsed = group.label && collapsedCats.has(group.label);
                const toggleCat = () => setCollapsedCats(prev => {
                  const next = new Set(prev);
                  next.has(group.label) ? next.delete(group.label) : next.add(group.label);
                  return next;
                });
                return (
                <div key={group.label}>
                  {group.label && (
                    <button onClick={toggleCat}
                      className="w-full text-[10px] font-bold uppercase px-1 pt-1.5 pb-0.5 flex items-center justify-between cursor-pointer"
                      style={{ color: "#e8b849", background: "none", border: "none" }}>
                      <span>{group.label} ({group.items.length})</span>
                      <span style={{ color: "#666", fontSize: 9 }}>{isCollapsed ? "▶" : "▼"}</span>
                    </button>
                  )}
                  {!isCollapsed && group.items.map(recipe => (
                    <div key={recipe._idx} className="flex items-center justify-between py-1.5 px-2 rounded mb-1 cursor-pointer"
                      style={{ ...btn("#2a2a2a", "#ccc"), cursor: "pointer" }} onClick={() => loadRecipeFromList(recipe)}>
                      <div>
                        <div className="text-sm font-bold" style={{ color: "#ccc" }}>{recipe.name}</div>
                        <div className="flex gap-1 mt-0.5 flex-wrap items-center">
                          {recipe.rules.map((r, ri) => <RuleBadge key={ri} rule={r} />)}
                          {recipe.green != null && recipe.red != null && (
                            <span className="text-[10px] ml-1" style={{ color: "#666" }}>
                              <span style={{ color: "#4ade80" }}>{recipe.green}</span>
                              {" → "}
                              <span style={{ color: "#ef4444" }}>{recipe.red}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); deleteCustomRecipe(recipe._idx); }}
                        className="text-xs px-2 hover:text-red-300 cursor-pointer" style={{ color: "#f87171" }}>✕</button>
                    </div>
                  ))}
                </div>
              );})}
            </div>
            <div className="flex gap-1 p-2" style={{ borderTop: "1px solid #333" }}>
              {customRecipes.length > 0 && (
                <button onClick={exportRecipes} className="text-xs px-2 py-1 rounded font-bold cursor-pointer" style={btn("#2d4a3d","#8ac68a")}>
                  {copied ? "✓ Copied!" : "Export All"}
                </button>
              )}
              <button onClick={() => setShowImport(!showImport)} className="text-xs px-2 py-1 rounded font-bold cursor-pointer" style={btn("#2d3a4a","#8ab8c6")}>
                Import
              </button>
            </div>
            {showImport && (
              <div className="flex gap-1 p-2" style={{ borderTop: "1px solid #333" }}>
                <input value={importStr} onChange={e => setImportStr(e.target.value)} placeholder="Paste recipe data..."
                  className="flex-1 rounded px-2 py-1 text-xs" style={{ background: "#1a1a16", color: "#ddd", boxShadow: "inset 1px 1px 0 #0d0d0a, inset -1px -1px 0 #333", border: "1px solid #111" }}
                  onKeyDown={e => e.key === "Enter" && importRecipesFromStr(importStr)} />
                <button onClick={() => importRecipesFromStr(importStr)} className="px-2 py-1 rounded text-xs font-bold cursor-pointer" style={btn("#2d4a2d","#6fc66f")}>Load</button>
              </div>
            )}
          </div>
        )}

        {/* Rules */}
        <div className="mb-2 rounded p-2" style={P}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold" style={{ color: "#999" }}>RULES</span>
            <div className="flex gap-1">
              <button onClick={() => setShowSaveDialog(true)} className="text-xs px-2 py-0.5 rounded font-bold cursor-pointer" style={btn("#2d4a2d","#6fc66f")}>💾 Save</button>
              {rules.length > 0 && (
                <button onClick={() => { setRules([]); setRecipeName(""); setActiveSlot(null); }} className="text-xs px-2 py-0.5 rounded font-bold cursor-pointer" style={btn("#4a2d2d","#c66f6f")}>Clear</button>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {SLOT_POSITIONS.map(pos => {
              const step = getSlotStep(pos);
              const isRed = step && ["hit", "draw"].includes(step);
              const isActive = activeSlot === pos;
              return (
                <div key={pos} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-bold" style={{ color: "#7a7a6a" }}>{ORDER_LABELS[pos]}</span>
                  {step ? (
                    <div className="relative flex flex-col items-center gap-0.5 p-2 rounded w-full cursor-pointer"
                      style={{
                        background: isRed ? "#3a1818" : "#183a18",
                        boxShadow: "inset 2px 2px 0 #0d0d0d, inset -2px -2px 0 #333",
                        border: isActive ? "2px solid #e8b849" : "2px solid #111",
                      }}
                      onClick={() => setActiveSlot(isActive ? null : pos)}>
                      <StepIcon type={step} size={28} />
                      <span className="text-[10px] font-bold" style={{ color: isRed ? "#ff8888" : "#88ff88" }}>{STEP_LABELS[step]}</span>
                      <button onClick={(e) => { e.stopPropagation(); clearSlot(pos); setActiveSlot(null); }}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px] cursor-pointer"
                        style={{ background: "#4a2d2d", color: "#f87171", border: "1px solid #111", lineHeight: 1 }}>×</button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-2 rounded w-full cursor-pointer"
                      style={{
                        background: "#1a1a16",
                        boxShadow: "inset 2px 2px 0 #0d0d0d, inset -2px -2px 0 #333",
                        border: isActive ? "2px solid #e8b849" : "2px dashed #333",
                        minHeight: 52,
                      }}
                      onClick={() => setActiveSlot(isActive ? null : pos)}>
                      <span className="text-lg" style={{ color: "#444" }}>+</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {activeSlot && (
            <div className="mt-2">
              <div className="text-[10px] font-bold mb-1" style={{ color: "#e8b849" }}>
                SELECT STEP → {ORDER_LABELS[activeSlot]}
              </div>
              <div className="flex gap-1 flex-wrap">
                {STEP_TYPES.map(s => {
                  const isRed = ["hit", "draw"].includes(s);
                  return (
                    <button key={s} onClick={() => setSlot(activeSlot, s)}
                      className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded cursor-pointer"
                      style={{
                        ...btn(isRed ? "#3a1818" : "#183a18", ""),
                        border: "2px solid #111",
                        minWidth: 48,
                      }}>
                      <StepIcon type={s} size={28} />
                      <span className="text-[10px] font-bold" style={{
                        color: isRed ? "#ff8888" : "#88ff88"
                      }}>{STEP_LABELS[s]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {showSaveDialog && (
            <div className="mt-2">
              <div className="flex items-center gap-2 mb-1.5">
                <input value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="Recipe name..."
                  className="flex-1 rounded px-2 py-1 text-xs" style={{ background: "#1a1a16", color: "#ddd", boxShadow: "inset 1px 1px 0 #0d0d0a, inset -1px -1px 0 #333", border: "1px solid #111" }}
                  onKeyDown={e => e.key === "Enter" && saveCurrentRecipe()} autoFocus />
                <button onClick={saveCurrentRecipe} className="px-2 py-1 rounded text-xs font-bold cursor-pointer" style={btn("#2d4a2d","#6fc66f")}>Save</button>
                <button onClick={() => { setShowSaveDialog(false); setSaveCategory(""); }} className="px-2 py-1 rounded text-xs font-bold cursor-pointer" style={btn("#333","#999")}>Cancel</button>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <input value={saveCategory} onChange={e => setSaveCategory(e.target.value)} placeholder="Category (optional)"
                  className="rounded px-2 py-1 text-xs" style={{ background: "#1a1a16", color: "#ddd", boxShadow: "inset 1px 1px 0 #0d0d0a, inset -1px -1px 0 #333", border: "1px solid #111", width: 130 }} />
                {existingCategories.map(cat => (
                  <button key={cat} onClick={() => setSaveCategory(saveCategory === cat ? "" : cat)}
                    className="text-[10px] px-1.5 py-0.5 rounded cursor-pointer font-bold"
                    style={{ background: saveCategory === cat ? "#3a5a3a" : "#333", color: saveCategory === cat ? "#88ff88" : "#888", border: `1px solid ${saveCategory === cat ? "#4a7a4a" : "#444"}` }}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="mb-2 rounded p-2" style={P}>
          <div className="flex items-center justify-between mb-0">
            <span className="text-xs font-bold" style={{ color: "#999" }}>PROGRESS</span>
            <div className="flex gap-3 text-xs items-center">
              <label className="flex items-center gap-1">
                <span style={{ color: "#4ade80" }}>●</span>
                <input type="number" min={0} max={150} value={green}
                  onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v)) setGreen(Math.max(0, Math.min(150, v))); }}
                  className="w-10 text-center text-xs font-bold rounded px-0.5 py-0.5"
                  style={{ background: "#1a1a16", color: "#4ade80", boxShadow: "inset 1px 1px 0 #0d0d0a, inset -1px -1px 0 #333", border: "1px solid #111" }} />
              </label>
              <label className="flex items-center gap-1">
                <span style={{ color: "#ef4444" }}>●</span>
                <input type="number" min={0} max={150} value={red}
                  onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v)) setRed(Math.max(0, Math.min(150, v))); }}
                  className="w-10 text-center text-xs font-bold rounded px-0.5 py-0.5"
                  style={{ background: "#1a1a16", color: "#ef4444", boxShadow: "inset 1px 1px 0 #0d0d0a, inset -1px -1px 0 #333", border: "1px solid #111" }} />
              </label>
              <span style={{ color: "#7a7a6a" }}>Δ {red - green}</span>
            </div>
          </div>
          <ProgressBar green={green} red={red} onGreenChange={setGreen} onRedChange={setRed} />
        </div>

        {/* Action buttons */}
        <div className="mb-2 rounded p-2" style={P}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold" style={{ color: "#999" }}>ACTIONS</span>
            <div className="flex gap-1 items-center">
              <button onClick={undo} disabled={performedSteps.length === 0} className="text-xs px-2 py-0.5 rounded cursor-pointer"
                style={{ ...btn("#333","#dda", "#555"), opacity: performedSteps.length === 0 ? 0.3 : 1 }}>Undo</button>
              <button onClick={reset} disabled={performedSteps.length === 0} className="text-xs px-2 py-0.5 rounded cursor-pointer"
                style={{ ...btn("#333","#999","#555"), opacity: performedSteps.length === 0 ? 0.3 : 1 }}>Reset</button>
              <span className="text-xs px-1" style={{ color: "#666" }}>Steps: {performedSteps.length}</span>
            </div>
          </div>
          <div className="flex gap-1 mb-1.5 flex-wrap">
            {["light-hit", "medium-hit", "hard-hit", "draw"].map(key => {
              const s = STEPS[key], dis = green + s.value < 0;
              return (
                <button key={key} onClick={() => performStep(key)} disabled={dis}
                  className="flex-1 min-w-[70px] py-2 rounded text-xs font-bold flex flex-col items-center gap-0.5 cursor-pointer"
                  style={{ ...btn(dis ? "#2a2020" : "#3a1818", dis ? "#663333" : "#ff8888"), opacity: dis ? 0.4 : 1 }}>
                  <StepIcon type={key} size={18} />
                  <span>{s.label}</span>
                  <span className="text-[10px]" style={{ color: dis ? "#552222" : "#cc5555" }}>{s.value}</span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-1 flex-wrap">
            {["punch", "bend", "upset", "shrink"].map(key => {
              const s = STEPS[key], dis = green + s.value > 150;
              return (
                <button key={key} onClick={() => performStep(key)} disabled={dis}
                  className="flex-1 min-w-[70px] py-2 rounded text-xs font-bold flex flex-col items-center gap-0.5 cursor-pointer"
                  style={{ ...btn(dis ? "#1a2a1a" : "#183a18", dis ? "#336633" : "#88ff88"), opacity: dis ? 0.4 : 1 }}>
                  <StepIcon type={key} size={18} />
                  <span>{s.label}</span>
                  <span className="text-[10px]" style={{ color: dis ? "#225522" : "#55cc55" }}>+{s.value}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Performed last 3 */}
        {performedSteps.length > 0 && (
          <div className="mb-2 rounded p-2" style={P}>
            <span className="text-xs font-bold" style={{ color: "#999" }}>LAST 3 PERFORMED</span>
            <div className="flex gap-3 mt-1.5 items-center">
              {[2, 1, 0].map(offset => {
                const idx = performedSteps.length - 1 - offset;
                const step = idx >= 0 ? performedSteps[idx] : null;
                const lbl = offset === 0 ? "Last" : offset === 1 ? "2nd Last" : "3rd Last";
                return (
                  <div key={offset} className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px]" style={{ color: "#666" }}>{lbl}</span>
                    <div className="px-2 py-1 rounded text-xs font-bold flex items-center justify-center gap-1" style={{
                      background: step ? (STEPS[step].color === "red" ? "#3a1818" : "#183a18") : "#1a1a16",
                      boxShadow: "inset 2px 2px 0 #0d0d0d, inset -2px -2px 0 #333",
                      border: "1px solid #111", color: step ? "#ddd" : "#444", minWidth: 60, textAlign: "center"
                    }}>
                      {step && <StepIcon type={step} size={14} />}
                      {step ? STEPS[step].label : "—"}
                    </div>
                  </div>
                );
              })}
              {isSolved && (
                <div className="ml-auto px-4 py-2 rounded text-sm font-bold" style={{
                  background: "#1a3a1a", color: "#4ade80", border: "2px solid #111",
                  boxShadow: "inset 2px 2px 0 #2a5a2a, inset -2px -2px 0 #0a1a0a, 0 0 12px rgba(74,222,128,0.3)",
                  fontFamily: "'Silkscreen', cursive", textShadow: "1px 1px 0 #0a1a0a",
                }}>✓ Forged!</div>
              )}
            </div>
          </div>
        )}

        {/* Solution table */}
        <div className="rounded p-2" style={{
          background: solution ? "#1d2d1a" : "#2d1a1a",
          boxShadow: `inset 2px 2px 0 ${solution ? "#2a4a2a" : "#4a2a2a"}, inset -2px -2px 0 #111`,
          border: "2px solid #111",
        }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold" style={{ color: "#999" }}>{solution ? "OPTIMAL SOLUTION" : "NO SOLUTION"}</span>
            {solution && solution.totalSteps > 0 && (
              <span className="text-xs" style={{ color: "#888" }}>
                {performedSteps.length > 0 ? `${solution.totalSteps} remaining` : `${solution.totalSteps} steps`}
              </span>
            )}
          </div>

          {solution && solutionTable.length > 0 ? (
            <div>
              <div className="flex text-[10px] font-bold mb-0.5 px-1" style={{ color: "#666" }}>
                <span style={{ width: 24 }}>#</span>
                <span className="flex-1">Action</span>
                <span style={{ width: 48, textAlign: "right" }}>Value</span>
                <span style={{ width: 48, textAlign: "right" }}>Pos</span>
              </div>
              <div className="rounded overflow-hidden" style={{ border: "1px solid #111", boxShadow: "inset 1px 1px 0 #0d0d0d" }}>
                {solutionTable.map((row, i) => {
                  const isRed = STEPS[row.key].color === "red";
                  const isNext = i === 0;
                  return (
                    <div key={i} className="flex items-center text-xs px-1.5 py-1"
                      style={{
                        background: isNext ? "#2a3518" : row.isEnding ? (isRed ? "#2d1a1a" : "#1a2d1a") : (i % 2 === 0 ? "#222" : "#252525"),
                        borderBottom: i < solutionTable.length - 1 ? "1px solid #2a2a2a" : "none",
                        borderLeft: isNext ? "3px solid #e8b849" : row.isEnding ? `3px solid ${isRed ? "#dc2626" : "#16a34a"}` : "3px solid transparent",
                      }}>
                      <span style={{ width: 24, color: isNext ? "#e8b849" : "#555", fontSize: 10, fontWeight: isNext ? "bold" : "normal" }}>{isNext ? "►" : row.idx}</span>
                      <span className="flex-1 font-bold flex items-center gap-1" style={{ color: isNext ? "#f0d060" : isRed ? "#ff8888" : "#88ff88" }}>
                        <StepIcon type={row.key} size={14} />
                        {row.label}
                      </span>
                      <span style={{ width: 48, textAlign: "right", color: isRed ? "#cc5555" : "#55cc55", fontWeight: "bold" }}>
                        {row.value > 0 ? "+" : ""}{row.value}
                      </span>
                      <span style={{ width: 48, textAlign: "right", color: row.to === red ? "#e8b849" : "#aaa", fontWeight: row.to === red ? "bold" : "normal" }}>
                        {row.to}
                      </span>
                    </div>
                  );
                })}
              </div>
              {rules.length > 0 && (
                <div className="mt-1.5 text-[10px]" style={{ color: "#555" }}>Highlighted rows = last 3 steps (rule-matching)</div>
              )}
            </div>
          ) : solution && solution.totalSteps === 0 ? (
            <p className="text-xs" style={{ color: "#8a8" }}>Already at target.</p>
          ) : (
            <p className="text-xs" style={{ color: "#a88" }}>
              {green === red ? "Position matched but no valid rule-satisfying path. Adjust rules." : "No valid path found. Try different positions or rules."}
            </p>
          )}
        </div>

        {/* Reference */}
        <details className="mt-3">
          <summary className="text-xs cursor-pointer font-bold" style={{ color: "#7a7a6a" }}>Step Values Reference</summary>
          <div className="mt-1 rounded p-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs" style={{ ...P, color: "#888" }}>
            {ALL_STEP_KEYS.map(k => (
              <div key={k} className="flex justify-between">
                <span>{STEPS[k].label}</span>
                <span style={{ color: STEPS[k].value < 0 ? "#f87171" : "#4ade80", fontWeight: "bold" }}>
                  {STEPS[k].value > 0 ? "+" : ""}{STEPS[k].value}
                </span>
              </div>
            ))}
          </div>
        </details>

      </div>
    </div>
  );
}

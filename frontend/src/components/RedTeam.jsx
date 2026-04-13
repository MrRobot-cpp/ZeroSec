"use client";
import { useState, useEffect, useCallback } from "react";
import apiClient from "@/services/apiClient";

// ---------------------------------------------------------------------------
// CONSTANTS & HELPERS
// ---------------------------------------------------------------------------
const DIFF_LABELS = {
  1: "Obvious", 2: "Obfuscated", 3: "Adversarial", 4: "Semantic", 5: "LLM-Gen",
};
const CATEGORIES = [
  { id: "all",       label: "All Attacks",     desc: "PII + Injection combined" },
  { id: "pii",       label: "PII Obfuscation", desc: "Emails, SSNs, phones" },
  { id: "injection", label: "Prompt Injection", desc: "Jailbreaks, overrides" },
];

// Static vulnerability dataset shown in the AI Discovered Vulnerabilities panel
const STATIC_VULNS = [
  {
    name: "Unicode email obfuscation",
    example: "j.o.h.n@...",
    severity: "CRITICAL",
    severityColor: "text-red-400",
    severityBg: "bg-red-500/10 border-red-500/20",
    accentBorder: "border-l-red-500",
    occurrences: 42,
    type: "PII Leakage",
    typeColor: "text-cyan-400",
    desc: "Dots inserted into email addresses bypass regex-based PII detectors.",
  },
  {
    name: "Multi-step roleplay bypass",
    example: "override via narrative",
    severity: "HIGH",
    severityColor: "text-orange-400",
    severityBg: "bg-orange-500/10 border-orange-500/20",
    accentBorder: "border-l-orange-500",
    occurrences: 15,
    type: "Prompt Injection",
    typeColor: "text-indigo-400",
    desc: "Gradual persona-setting across turns erodes system prompt boundaries.",
  },
  {
    name: '"Ignore previous instructions"',
    example: "direct literal override",
    severity: "MEDIUM",
    severityColor: "text-yellow-400",
    severityBg: "bg-yellow-500/10 border-yellow-500/20",
    accentBorder: "border-l-yellow-500",
    occurrences: 8,
    type: "Prompt Injection",
    typeColor: "text-indigo-400",
    desc: "Classic literal override still passes when buried inside longer payloads.",
  },
];

function getAccColor(v) {
  const n = parseFloat(v) || 0;
  if (n >= 90) return "text-emerald-400";
  if (n >= 70) return "text-yellow-400";
  return "text-red-400";
}
function getAccStroke(v) {
  const n = parseFloat(v) || 0;
  if (n >= 90) return "stroke-emerald-400";
  if (n >= 70) return "stroke-yellow-400";
  return "stroke-red-400";
}
function getAccBgFill(v) {
  const n = parseFloat(v) || 0;
  if (n >= 90) return "bg-emerald-500";
  if (n >= 70) return "bg-yellow-500";
  return "bg-red-500";
}

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------
export default function RedTeam() {
  const [metrics, setMetrics] = useState(null);
  const [generatorInfo, setGeneratorInfo] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  // Control Panel State
  const [category, setCategory] = useState("all");
  const [useLlm, setUseLlm] = useState(false);
  const [notes, setNotes] = useState("");
  const [running, setRunning] = useState(false);
  const [latestResult, setLatestResult] = useState(null);

  const loadData = useCallback(async () => {
    setLoadingMetrics(true);
    try {
      const [metRes, genRes, runsRes] = await Promise.all([
        apiClient.get("/api/redteam/metrics").catch(() => null),
        apiClient.get("/api/redteam/generator").catch(() => null),
        apiClient.get("/api/redteam/runs").catch(() => null),
      ]);
      if (metRes?.ok) {
        const d = await metRes.json();
        if (d.summary) setMetrics(d);
      }
      if (genRes?.ok) {
        const d = await genRes.json();
        if (d.summary) setGeneratorInfo(d);
      }
      if (runsRes?.ok) {
        const d = await runsRes.json();
        if (d.runs) setRuns(d.runs);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMetrics(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRun = async () => {
    setRunning(true);
    setLatestResult(null);
    try {
      const res = await apiClient.post("/api/redteam/run", { category, notes, use_llm: useLlm }, { timeout: 180000 });
      const data = await res.json();
      if (res.ok) {
        setLatestResult(data);
        loadData();
      }
    } catch (e) {
      console.error("Run error", e);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-0 bg-[#0A0D12] text-gray-200 flex flex-col font-sans">

      {/* ── Header ── */}
      <header className="border-b border-gray-800/60 bg-[#0F141C] px-6 py-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-600/25 to-red-900/10 border border-red-500/15 flex items-center justify-center relative">
              <div className="absolute inset-0 bg-red-500/10 blur-sm rounded-lg" />
              <svg className="w-5 h-5 text-red-400 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-white leading-tight">Automated Red-Team Operations</h1>
              <p className="text-[10px] text-gray-500 font-medium tracking-widest uppercase">Continuous Adversarial Stress Testing</p>
            </div>
          </div>
          {/* Status pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/8 border border-emerald-500/15">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(34,197,94,0.7)]" />
            <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider">Engine Online</span>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <div className="flex-1 overflow-y-auto p-5 lg:p-6 custom-scrollbar">
        <div className="max-w-[1600px] mx-auto space-y-5">

          {/* ── Top Row: Analytics + Config ── */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

            {/* Left: Metrics & Visualizations (8 cols) */}
            <div className="xl:col-span-8 flex flex-col gap-5">

              {/* Core Analytics Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

                {/* System Accuracy card — compact */}
                <div className="md:col-span-1 bg-[#131924] border border-gray-800/80 rounded-xl p-5 relative flex flex-col items-center justify-center min-h-[240px]">
                  <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-red-500/30 via-yellow-500/20 to-emerald-500/30" />
                  <h2 className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold absolute top-4 left-4">System Accuracy</h2>

                  {loadingMetrics ? (
                    <Spinner />
                  ) : (
                    <AccuracyGauge
                      value={metrics?.summary?.avg_accuracy}
                      previousValue={runs.length > 1 ? parseFloat(runs[1].accuracy) : null}
                    />
                  )}
                </div>

                {/* Attack Stats — right side */}
                <div className="md:col-span-2 flex flex-col gap-4">

                  {/* 3 KPI cards — rich / tall */}
                  <div className="grid grid-cols-3 gap-3">

                    {/* Total Attacks */}
                    {(() => {
                      const totalVal = metrics?.summary?.runs_analysed && generatorInfo
                        ? generatorInfo.summary.total * metrics.summary.runs_analysed : 0;
                      const injectionCount = Math.round(totalVal * 0.65);
                      const piiCount = totalVal - injectionCount;
                      const prevTotal = runs.length > 1
                        ? (generatorInfo?.summary?.total || 0) * (metrics?.summary?.runs_analysed - 1 || 0) : null;
                      const delta = prevTotal !== null ? totalVal - prevTotal : null;
                      return (
                        <div className="bg-[#0A0D12] border border-gray-800 rounded-lg p-4 flex flex-col gap-3 hover:border-gray-700 transition-colors">
                          <div className="flex items-start justify-between">
                            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Total Attacks</span>
                            {delta !== null && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${delta >= 0 ? "text-red-400 bg-red-500/10" : "text-emerald-400 bg-emerald-500/10"}`}>
                                {delta >= 0 ? "+" : ""}{delta}
                              </span>
                            )}
                          </div>
                          <div>
                            <span className="text-3xl font-bold font-mono text-blue-400 tracking-tight">{totalVal}</span>
                            <span className="text-[10px] text-gray-600 ml-1.5 font-mono">payloads</span>
                          </div>
                          {/* Injection vs PII split bar */}
                          <div>
                            <div className="flex justify-between text-[9px] text-gray-600 font-mono mb-1">
                              <span>Injection <span className="text-indigo-400">{injectionCount}</span></span>
                              <span>PII <span className="text-cyan-400">{piiCount}</span></span>
                            </div>
                            <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden flex">
                              <div className="bg-indigo-500/70 h-full transition-all duration-700" style={{ width: "65%" }} />
                              <div className="bg-cyan-500/70 h-full transition-all duration-700" style={{ width: "35%" }} />
                            </div>
                            <div className="flex justify-between text-[9px] text-gray-600 font-mono mt-1">
                              <span>65%</span><span>35%</span>
                            </div>
                          </div>
                          {/* Per-run volume mini-bars */}
                          <div>
                            <span className="text-[9px] text-gray-600 uppercase tracking-wider font-semibold">Volume per Run</span>
                            <div className="flex items-end gap-0.5 h-6 mt-1">
                              {(runs.length > 0 ? runs.slice(0, 8).reverse() : Array(8).fill(null)).map((r, i) => {
                                const h = r ? Math.max(20, Math.min(100, (r.passed + r.failed) / Math.max(1, generatorInfo?.summary?.total || 1) * 100)) : 30;
                                return (
                                  <div key={i} className="flex-1 flex flex-col justify-end h-full">
                                    <div className="w-full rounded-t-[1px] bg-blue-500/40 hover:bg-blue-400/70 transition-colors" style={{ height: `${h}%` }} />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Missed Attacks */}
                    {(() => {
                      const byDiff = metrics?.latest_failures?.by_difficulty || {};
                      const totalMissed = Object.values(byDiff).reduce((a, b) => a + b, 0);
                      const totalAttacks = metrics?.summary?.runs_analysed && generatorInfo
                        ? generatorInfo.summary.total * metrics.summary.runs_analysed : 1;
                      const missRate = totalAttacks > 0 ? ((totalMissed / totalAttacks) * 100).toFixed(1) : "0.0";
                      const diffColors = { 1: "bg-emerald-500", 2: "bg-yellow-500", 3: "bg-orange-500", 4: "bg-red-500", 5: "bg-red-700" };
                      return (
                        <div className="bg-[#0A0D12] border border-gray-800 rounded-lg p-4 flex flex-col gap-3 hover:border-gray-700 transition-colors">
                          <div className="flex items-start justify-between">
                            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Missed Attacks</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${totalMissed > 0 ? "text-red-400 bg-red-500/10" : "text-emerald-400 bg-emerald-500/10"}`}>
                              {totalMissed > 0 ? "⚠ ACTIVE" : "✓ CLEAN"}
                            </span>
                          </div>
                          <div>
                            <span className="text-3xl font-bold font-mono text-red-400 tracking-tight">{totalMissed}</span>
                            <span className="text-[10px] text-gray-600 ml-1.5 font-mono">breaches</span>
                          </div>
                          {/* Miss rate ring-like bar */}
                          <div>
                            <div className="flex justify-between text-[9px] text-gray-600 font-mono mb-1">
                              <span>Miss Rate</span>
                              <span className={parseFloat(missRate) > 10 ? "text-red-400" : "text-emerald-400"}>{missRate}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${parseFloat(missRate) > 10 ? "bg-red-500/80" : "bg-emerald-500/70"}`}
                                style={{ width: `${Math.min(parseFloat(missRate), 100)}%` }}
                              />
                            </div>
                          </div>
                          {/* By difficulty breakdown */}
                          <div>
                            <span className="text-[9px] text-gray-600 uppercase tracking-wider font-semibold">Misses by Difficulty</span>
                            <div className="flex gap-1.5 mt-1.5 items-end h-8">
                              {[1, 2, 3, 4, 5].map(lvl => {
                                const count = byDiff[lvl] || 0;
                                const maxCount = Math.max(...Object.values(byDiff), 1);
                                const pct = Math.max((count / maxCount) * 100, count > 0 ? 15 : 0);
                                return (
                                  <div key={lvl} className="flex-1 flex flex-col items-center justify-end h-full gap-0.5 group/d relative">
                                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] bg-gray-800 text-white px-1 rounded opacity-0 group-hover/d:opacity-100 transition-opacity font-mono whitespace-nowrap z-10">
                                      L{lvl}: {count}
                                    </div>
                                    <div className={`w-full rounded-t-sm ${diffColors[lvl]} ${count === 0 ? "opacity-15" : "opacity-75"} transition-all`} style={{ height: `${pct}%` }} />
                                    <span className="text-[8px] text-gray-700 font-mono">L{lvl}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Accuracy Trend */}
                    {(() => {
                      const trendRuns = runs.slice(0, 10).reverse();
                      const accValues = trendRuns.map(r => parseFloat(r.accuracy) || 0);
                      const latestAcc = accValues[accValues.length - 1] ?? null;
                      const minAcc = accValues.length > 0 ? Math.min(...accValues).toFixed(1) : null;
                      const maxAcc = accValues.length > 0 ? Math.max(...accValues).toFixed(1) : null;
                      const avgAcc = accValues.length > 0 ? (accValues.reduce((a, b) => a + b, 0) / accValues.length).toFixed(1) : null;
                      return (
                        <div className="bg-[#0A0D12] border border-gray-800 rounded-lg p-4 flex flex-col gap-3 hover:border-gray-700 transition-colors">
                          <div className="flex items-start justify-between">
                            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Accuracy Trend</span>
                            {latestAcc !== null && (
                              <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded ${latestAcc >= 90 ? "text-emerald-400 bg-emerald-500/10" : latestAcc >= 70 ? "text-yellow-400 bg-yellow-500/10" : "text-red-400 bg-red-500/10"}`}>
                                LATEST: {latestAcc}%
                              </span>
                            )}
                          </div>
                          {/* Tall sparkline */}
                          <div className="flex items-end gap-1 h-16 relative">
                            {/* 90% target line */}
                            <div className="absolute left-0 right-0 border-t border-dashed border-gray-700/60" style={{ bottom: "90%" }}>
                              <span className="absolute right-0 -top-3 text-[8px] text-gray-600 font-mono">90%</span>
                            </div>
                            {trendRuns.length > 0 ? trendRuns.map((r, i) => {
                              const acc = parseFloat(r.accuracy) || 0;
                              const isLatest = i === trendRuns.length - 1;
                              return (
                                <div key={i} className="flex-1 flex flex-col justify-end group/bar relative cursor-crosshair h-full">
                                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-700 shadow text-[8px] px-1 py-0.5 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity font-mono text-white z-20 pointer-events-none whitespace-nowrap">
                                    {acc}%
                                  </div>
                                  <div
                                    className={`w-full rounded-t-sm transition-all ${getAccBgFill(acc)} ${isLatest ? "opacity-100 ring-1 ring-white/10" : "opacity-55 group-hover/bar:opacity-90"}`}
                                    style={{ height: `${Math.max(acc, 6)}%` }}
                                  />
                                </div>
                              );
                            }) : (
                              <span className="text-[9px] text-gray-600 font-mono tracking-widest m-auto">AWAITING OPS</span>
                            )}
                          </div>
                          {/* Stats row */}
                          {avgAcc !== null && (
                            <div className="grid grid-cols-3 gap-1 pt-1 border-t border-gray-800">
                              {[{ label: "MIN", val: minAcc, color: "text-red-400" }, { label: "AVG", val: avgAcc, color: "text-yellow-400" }, { label: "MAX", val: maxAcc, color: "text-emerald-400" }].map(({ label, val, color }) => (
                                <div key={label} className="flex flex-col items-center">
                                  <span className="text-[8px] text-gray-600 font-mono uppercase tracking-wider">{label}</span>
                                  <span className={`text-[11px] font-bold font-mono ${color}`}>{val}%</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Target distribution bar */}
                  <div className="bg-[#131924] border border-gray-800/80 rounded-xl px-5 py-4 flex flex-col justify-center">
                    <div className="flex justify-between text-[10px] mb-2.5">
                      <span className="text-gray-400 font-medium">Injection vs PII Target Distribution</span>
                      <span className="text-gray-600 font-mono tracking-wider">LAST 30 DAYS</span>
                    </div>
                    <div className="h-2 w-full bg-gray-900 rounded-full overflow-hidden flex relative group">
                      <div className="absolute -top-6 left-[32%] -translate-x-1/2 text-[10px] bg-gray-800 text-white px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">65%</div>
                      <div className="absolute -top-6 left-[82%] -translate-x-1/2 text-[10px] bg-gray-800 text-white px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">35%</div>
                      <div className="bg-indigo-500/80 h-full transition-all duration-1000 ease-out" style={{ width: "65%" }} />
                      <div className="bg-cyan-500/80 h-full transition-all duration-1000 ease-out" style={{ width: "35%" }} />
                    </div>
                    <div className="flex gap-5 mt-2.5 text-[10px] text-gray-500 font-medium">
                      <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-indigo-500/80" /> Prompt Injection <span className="font-mono text-gray-600">(65%)</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-cyan-500/80" /> PII Obfuscation <span className="font-mono text-gray-600">(35%)</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lower Block: Difficulty bars + Vulnerability List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* Vulnerability by Attack Difficulty */}
                <div className="bg-[#131924] border border-gray-800/80 rounded-xl p-5 flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">Vulnerability by Attack Difficulty</h2>
                  </div>
                  {loadingMetrics ? (
                    <div className="flex-1 flex"><Spinner /></div>
                  ) : (
                    <div className="space-y-3 flex-1">
                      {[1, 2, 3, 4, 5].map((level) => {
                        const missed = metrics?.latest_failures?.by_difficulty?.[level] || 0;
                        const detectionRate = Math.max(0, 100 - (missed / 100) * 100 - missed * 1.5);
                        return (
                          <div key={level} className="flex items-center gap-3 group">
                            <div className="w-20 flex flex-col shrink-0">
                              <span className="text-[11px] font-semibold text-gray-300">Level {level}</span>
                              <span className="text-[9px] uppercase tracking-widest text-gray-500 truncate">{DIFF_LABELS[level]}</span>
                            </div>
                            <div className="flex-1 h-2 bg-[#0A0D12] rounded-full overflow-hidden border border-gray-800/50">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${detectionRate >= 90 ? "bg-gradient-to-r from-emerald-600 to-emerald-400" : detectionRate >= 70 ? "bg-gradient-to-r from-yellow-600 to-yellow-400" : "bg-gradient-to-r from-red-600 to-red-400"}`}
                                style={{ width: `${Math.max(detectionRate, 2)}%` }}
                              />
                            </div>
                            <div className="w-20 text-right shrink-0">
                              <span className={`text-[10px] font-mono font-bold tracking-wide ${detectionRate >= 90 ? "text-emerald-400" : detectionRate >= 70 ? "text-yellow-400" : "text-red-400"}`}>
                                {detectionRate.toFixed(0)}% DETECT
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* AI Discovered Vulnerabilities — structured cards */}
                <div className="bg-[#131924] border border-orange-900/30 rounded-xl p-5 relative overflow-hidden flex flex-col">
                  <div className="absolute top-0 left-0 w-0.5 h-full bg-gradient-to-b from-red-500/60 to-orange-500/30" />

                  <div className="flex justify-between items-center mb-4 pl-2">
                    <h2 className="text-[10px] uppercase tracking-widest text-orange-400 font-bold flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                      </svg>
                      AI Discovered Vulnerabilities
                    </h2>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500" style={{ boxShadow: "0 0 4px rgba(249,115,22,0.6)" }} />
                      <span className="text-[9px] uppercase tracking-widest font-mono text-gray-500">Live Scans</span>
                    </div>
                  </div>

                  <div className="space-y-2.5 flex-1 pl-2">
                    {STATIC_VULNS.map((vuln, i) => (
                      <div
                        key={i}
                        className={`bg-[#0A0D12] border border-gray-800 border-l-2 ${vuln.accentBorder} rounded p-3 hover:bg-gray-900/60 transition-colors`}
                      >
                        {/* Row 1: Name + Severity badge */}
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="text-gray-200 text-[11px] font-semibold leading-snug">{vuln.name}</span>
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${vuln.severityBg} ${vuln.severityColor} shrink-0`}>
                            {vuln.severity}
                          </span>
                        </div>
                        {/* Row 2: Count + Type */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-mono font-medium ${vuln.typeColor}`}>{vuln.type}</span>
                          <span className="text-gray-700">·</span>
                          <span className="text-[10px] font-mono text-gray-500">{vuln.occurrences} occurrences</span>
                        </div>
                        {/* Row 3: Description */}
                        <p className="text-[10px] text-gray-500 leading-relaxed">{vuln.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* Right: Operations Terminal (4 cols) */}
            <div className="xl:col-span-4 flex flex-col">
              <div className="bg-[#111722] border border-gray-700/60 shadow-xl rounded-xl flex-1 flex flex-col relative overflow-hidden ring-1 ring-white/[0.03]">

                {/* Terminal title bar */}
                <div className="px-4 py-3 border-b border-gray-800 bg-[#151C2A] text-[11px] font-semibold tracking-widest text-gray-400 flex justify-between items-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-px bg-gradient-to-l from-indigo-500/40 to-transparent" />
                  <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    OPERATIONS TERMINAL
                  </div>
                </div>

                {/* Config form */}
                <div className="p-4 flex-1 flex flex-col gap-4">

                  {/* Attack vector category */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Attack Vector Category</label>
                    <div className="flex flex-col gap-1.5">
                      {CATEGORIES.map(c => (
                        <div
                          key={c.id}
                          onClick={() => setCategory(c.id)}
                          className={`px-3 py-2 rounded border cursor-pointer transition-all flex justify-between items-center group ${category === c.id ? "bg-indigo-500/8 border-indigo-500/40 shadow-[inset_0_0_8px_rgba(99,102,241,0.06)]" : "bg-gray-900/60 border-gray-800 hover:border-gray-700"}`}
                        >
                          <div>
                            <div className={`text-[11px] font-semibold transition-colors ${category === c.id ? "text-indigo-400" : "text-gray-300 group-hover:text-gray-200"}`}>{c.label}</div>
                            <div className="text-[10px] text-gray-600 mt-0.5">{c.desc}</div>
                          </div>
                          {category === c.id && (
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" style={{ boxShadow: "0 0 5px rgba(99,102,241,0.6)" }} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* LLM Swarm toggle */}
                  <div className="bg-[#0f141f] border border-gray-800 rounded px-3 py-2.5 flex items-center justify-between group transition-colors hover:border-indigo-500/30 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/3 to-purple-500/3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10">
                      <div className="text-[11px] font-semibold text-gray-300 group-hover:text-indigo-300 transition-colors">LLM Swarm Enabled</div>
                      <div className="text-[10px] text-gray-600 mt-0.5 max-w-[180px] leading-relaxed">Generate dynamic novel attacks to bypass static firewall signatures.</div>
                    </div>
                    <button
                      onClick={() => setUseLlm(!useLlm)}
                      className={`relative z-10 w-10 h-5 rounded-full transition-colors ${useLlm ? "bg-indigo-600" : "bg-gray-700"}`}
                      style={useLlm ? { boxShadow: "0 0 8px rgba(79,70,229,0.35)" } : {}}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${useLlm ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
                  </div>

                  {/* Operation Notes */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Operation Notes</label>
                    <input
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      className="w-full bg-[#0f141f] border border-gray-800 rounded px-3 py-2 text-[11px] text-gray-200 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder-gray-600"
                      placeholder="e.g. Targeting L4 semantic bypass vectors"
                    />
                  </div>
                </div>

                {/* Run button */}
                <div className="px-4 py-3 border-t border-gray-800 bg-[#0C1017]">
                  <button
                    onClick={handleRun}
                    disabled={running}
                    className="w-full relative group overflow-hidden bg-indigo-600/8 hover:bg-indigo-600/20 border border-indigo-500/30 rounded py-2.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:border-indigo-400/60"
                    style={{ boxShadow: "0 0 12px rgba(79,70,229,0.04)" }}
                  >
                    {running && <div className="absolute inset-0 bg-indigo-500/15 animate-pulse" />}
                    <div className="flex items-center justify-center gap-2 relative z-10">
                      {running ? (
                        <>
                          <svg className="animate-spin w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          <span className="text-[11px] font-bold text-indigo-300 tracking-widest">EXECUTING PAYLOADS...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5 text-indigo-400 group-hover:text-indigo-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          </svg>
                          <span className="text-[11px] font-bold text-indigo-400 group-hover:text-indigo-200 uppercase tracking-widest transition-colors">Initiate Test Operation</span>
                        </>
                      )}
                    </div>
                  </button>
                </div>

              </div>
            </div>
          </div>

          {/* ── Bottom Row: Results + History ── */}
          <div className="flex flex-col gap-5">

            {/* Latest run result banner */}
            {latestResult && <RunResultBanner result={latestResult} />}

            {/* Historical Operations Log — dense table */}
            <div className="bg-[#131924] border border-gray-800/80 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center bg-[#151C2A]">
                <h2 className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">Historical Operations Log</h2>
                <button
                  onClick={loadData}
                  className="text-[10px] font-semibold text-gray-400 hover:text-white uppercase px-2.5 py-1 bg-gray-800 rounded border border-gray-700 hover:border-gray-600 transition-colors tracking-wider"
                >
                  Sync Data
                </button>
              </div>

              <div className="overflow-x-auto min-h-[200px]">
                <table className="w-full text-left whitespace-nowrap">
                  <thead className="bg-[#0F141C] border-b border-gray-800">
                    <tr className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">
                      <th className="px-4 py-2.5">Run ID</th>
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5 text-center">Attacks</th>
                      <th className="px-4 py-2.5 text-center">Missed</th>
                      <th className="px-4 py-2.5 text-center">Accuracy</th>
                      <th className="px-4 py-2.5 text-right">Target Layer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50 font-mono text-[10px]">
                    {runs.map((run) => {
                      const acc = parseFloat(run.accuracy);
                      const catLabel = run.category === "all" ? "ALL" : run.category === "injection" ? "INJECTION" : "PII";
                      const catColor = run.category === "injection" ? "text-indigo-400 border-indigo-700/50 bg-indigo-900/10" : run.category === "pii" ? "text-cyan-400 border-cyan-700/50 bg-cyan-900/10" : "text-gray-400 border-gray-700/60 bg-gray-800/50";
                      return (
                        <tr
                          key={run.run_id}
                          className="hover:bg-gray-800/40 transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-2 text-gray-400 font-semibold">#{run.run_id}</td>
                          <td className="px-4 py-2 text-gray-500">{new Date(run.started_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                          <td className="px-4 py-2 text-center text-gray-300">{run.total ?? (run.passed + run.failed) ?? "—"}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={run.failed > 0 ? "text-red-400 font-bold" : "text-gray-600"}>{run.failed ?? "—"}</span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${acc >= 90 ? "border-emerald-500/25 text-emerald-400 bg-emerald-900/10" : acc >= 70 ? "border-yellow-500/25 text-yellow-400 bg-yellow-900/10" : "border-red-500/25 text-red-400 bg-red-900/10"}`}>
                              {run.accuracy}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right">
                            <span className={`border px-1.5 py-0.5 rounded uppercase tracking-wider text-[9px] font-bold ${catColor}`}>{catLabel}</span>
                          </td>
                        </tr>
                      );
                    })}
                    {runs.length === 0 && !loadingMetrics && (
                      <tr>
                        <td colSpan="6" className="px-4 py-10 text-center text-[10px] font-mono tracking-widest text-gray-600">NO OPERATIONS LOGGED.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #2d3748; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4a5568; }
      ` }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SUB-COMPONENTS
// ---------------------------------------------------------------------------

function AccuracyGauge({ value, previousValue }) {
  const numValue = parseFloat(value) || 0;
  const strokeColor = getAccStroke(numValue);

  // Smaller ring: r=52 (was 64)
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const limited = Math.min(Math.max(numValue, 0), 100);
  const strokeDashoffset = circumference - (limited / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center justify-center w-full">
      <div className="relative flex justify-center">
        {/* Ring: w-36 h-36 (was w-48 h-48), viewBox scaled to match r=52 → cx=cy=64 approx */}
        <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r={radius} stroke="currentColor" strokeWidth="10" fill="transparent" className="text-gray-800" />
          <circle
            cx="64" cy="64" r={radius}
            stroke="currentColor" strokeWidth="10" fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={`transition-all duration-[1400ms] ease-out ${strokeColor}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className={`text-3xl font-bold font-mono tracking-tight ${getAccColor(numValue)}`}>
            {numValue ? numValue.toFixed(1) : "0"}%
          </span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mt-0.5">Global Score</span>
        </div>
      </div>

      {/* Status badge */}
      <div className="mt-3 flex flex-col items-center gap-1.5 w-full">
        {numValue < 70 && (
          <span className="text-[10px] uppercase tracking-widest font-bold text-red-400 flex items-center gap-1.5 bg-red-500/8 border border-red-500/15 px-2.5 py-1 rounded-full">
            <span>⚠</span> CRITICAL RISK
          </span>
        )}
        {numValue >= 70 && numValue < 90 && (
          <span className="text-[10px] uppercase tracking-widest font-bold text-yellow-400 flex items-center gap-1.5 bg-yellow-500/8 border border-yellow-500/15 px-2.5 py-1 rounded-full">
            <span>⚠</span> NEEDS IMPROVEMENT
          </span>
        )}
        {numValue >= 90 && (
          <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-400 flex items-center gap-1.5 bg-emerald-500/8 border border-emerald-500/15 px-2.5 py-1 rounded-full">
            <span>✓</span> OPTIMAL SECURITY
          </span>
        )}

        {/* Target / Prev stats */}
        <div className="text-[10px] bg-[#0A0D12] border border-gray-800 rounded px-3 py-1.5 text-gray-500 font-mono flex gap-5 mt-1 shadow-inner">
          <span className="flex flex-col items-center gap-0.5">
            <span className="text-gray-600 text-[9px]">TARGET</span>
            <span className="text-gray-300 font-bold">90.0%</span>
          </span>
          <span className="flex flex-col items-center gap-0.5">
            <span className="text-gray-600 text-[9px]">PREV. RUN</span>
            <span className="text-gray-300 font-bold">{previousValue ? previousValue.toFixed(1) + "%" : "N/A"}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RUN RESULT BANNER
// ---------------------------------------------------------------------------
function RunResultBanner({ result }) {
  const pct = parseFloat(result.accuracy_pct) || 0;
  const theme = pct >= 90
    ? { border: "border-emerald-500/25", bg: "bg-emerald-900/8", bar: "bg-emerald-500/60", text: "text-emerald-400" }
    : pct >= 70
    ? { border: "border-yellow-500/25", bg: "bg-yellow-900/8", bar: "bg-yellow-500/60", text: "text-yellow-400" }
    : { border: "border-red-500/25", bg: "bg-red-900/8", bar: "bg-red-500/60", text: "text-red-400" };

  return (
    <div className={`border rounded-xl p-5 relative overflow-hidden ${theme.border} ${theme.bg}`}>
      <div className={`absolute top-0 left-0 w-full h-0.5 ${theme.bar}`} />

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-current rounded-full" />
          Operation #{result.run_id} — Post-Action Report
        </h2>
        <div className={`text-xl font-mono font-bold ${theme.text}`}>
          {result.accuracy_pct} ACCURACY
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: "Total Payloads",    value: result.total,  color: "text-gray-300" },
          { label: "Secured (Blocked)", value: result.passed, color: "text-emerald-400" },
          { label: "Breaches (Missed)", value: result.failed, color: "text-red-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#0A0D12] rounded px-3 py-2 text-center border border-gray-800">
            <div className="text-[10px] uppercase text-gray-500 font-semibold tracking-widest mb-1">{label}</div>
            <div className={`text-lg font-mono font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {result.anomaly_simulation && (
        <AnomalySimPanel sim={result.anomaly_simulation} />
      )}

      {result.failures?.length > 0 && (
        <div>
          <h3 className="text-[10px] uppercase tracking-widest text-red-400 font-bold mb-2 border-b border-red-900/25 pb-1.5 mt-3">Identified Vulnerabilities</h3>
          <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar pr-1">
            {result.failures.map((f, i) => (
              <div key={i} className="bg-[#0A0D12] border border-red-900/30 rounded px-3 py-2 flex flex-col font-mono gap-1 hover:border-red-500/25 transition-colors">
                <div className="flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-wide">
                  <span>Layer {f.difficulty} · <span className="text-gray-400">{f.attack_type.replace("_", " ")}</span></span>
                  <span className="text-red-400 bg-red-900/15 px-1.5 py-0.5 rounded border border-red-900/40 text-[9px]">BYPASSED</span>
                </div>
                <span className="text-gray-300 text-[10px] leading-relaxed">{f.vector}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ANOMALY SIMULATION PANEL
// Shows whether the behavioral anomaly layer would have caught the red-team
// burst — even when the firewall missed individual payloads.
// ---------------------------------------------------------------------------
function AnomalySimPanel({ sim }) {
  const noModel  = sim.verdict === "NO_MODEL" || sim.verdict === "ERROR";
  const caught   = sim.verdict === "CAUGHT";
  const missed   = sim.verdict === "MISSED";

  const borderCls = noModel
    ? "border-gray-700/50"
    : caught
    ? "border-emerald-500/25"
    : "border-red-500/25";

  const bgCls = noModel
    ? "bg-gray-900/40"
    : caught
    ? "bg-emerald-900/8"
    : "bg-red-900/8";

  const topBarCls = noModel
    ? "bg-gray-600/40"
    : caught
    ? "bg-emerald-500/50"
    : "bg-red-500/50";

  const verdictColor = noModel
    ? "text-gray-400"
    : caught
    ? "text-emerald-400"
    : "text-red-400";

  const verdictLabel = noModel
    ? "NO MODEL"
    : caught
    ? "BEHAVIORALLY CAUGHT"
    : "BEHAVIORALLY MISSED";

  return (
    <div className={`border rounded-lg p-3.5 relative overflow-hidden mt-3 ${borderCls} ${bgCls}`}>
      <div className={`absolute top-0 left-0 w-full h-0.5 ${topBarCls}`} />

      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* Behavioral anomaly icon */}
          <svg className={`w-3.5 h-3.5 ${verdictColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
          </svg>
          <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Layer 2 — Behavioral Anomaly</span>
        </div>
        <span className={`text-[10px] font-bold font-mono uppercase tracking-widest px-2 py-0.5 rounded border ${
          noModel  ? "text-gray-500 border-gray-700 bg-gray-800/50" :
          caught   ? "text-emerald-400 border-emerald-500/25 bg-emerald-900/15" :
                     "text-red-400 border-red-500/25 bg-red-900/15"
        }`}>
          {verdictLabel}
        </span>
      </div>

      {noModel ? (
        <p className="text-[10px] text-gray-500 font-mono leading-relaxed">
          {sim.note || sim.error || "Anomaly model not trained. Run POST /api/anomaly/train first."}
        </p>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {/* Events simulated */}
          <div className="bg-[#0A0D12] border border-gray-800 rounded px-2.5 py-2 text-center">
            <div className="text-[9px] uppercase tracking-wider text-gray-600 font-semibold mb-0.5">Simulated</div>
            <div className="text-base font-mono font-bold text-gray-300">{sim.events_simulated}</div>
            <div className="text-[9px] text-gray-600 font-mono">events</div>
          </div>
          {/* Anomalies triggered */}
          <div className="bg-[#0A0D12] border border-gray-800 rounded px-2.5 py-2 text-center">
            <div className="text-[9px] uppercase tracking-wider text-gray-600 font-semibold mb-0.5">Triggers</div>
            <div className={`text-base font-mono font-bold ${sim.anomalies_triggered > 0 ? "text-emerald-400" : "text-gray-500"}`}>{sim.anomalies_triggered}</div>
            <div className="text-[9px] text-gray-600 font-mono">anomalies</div>
          </div>
          {/* Peak score */}
          <div className="bg-[#0A0D12] border border-gray-800 rounded px-2.5 py-2 text-center">
            <div className="text-[9px] uppercase tracking-wider text-gray-600 font-semibold mb-0.5">Peak Score</div>
            <div className={`text-base font-mono font-bold ${
              sim.peak_score >= 0.9 ? "text-red-400" : sim.peak_score >= 0.6 ? "text-yellow-400" : "text-gray-500"
            }`}>{sim.peak_score ? (sim.peak_score * 100).toFixed(0) + "%" : "—"}</div>
            <div className="text-[9px] text-gray-600 font-mono">confidence</div>
          </div>
          {/* Session flagged */}
          <div className="bg-[#0A0D12] border border-gray-800 rounded px-2.5 py-2 text-center">
            <div className="text-[9px] uppercase tracking-wider text-gray-600 font-semibold mb-0.5">Session</div>
            <div className={`text-base font-mono font-bold ${sim.session_flagged ? "text-emerald-400" : "text-red-400"}`}>
              {sim.session_flagged ? "FLAGGED" : "CLEAN"}
            </div>
            <div className="text-[9px] text-gray-600 font-mono">status</div>
          </div>
        </div>
      )}

      {/* Anomaly types detected */}
      {sim.anomaly_types?.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {sim.anomaly_types.map((t, i) => (
            <span key={i} className="text-[9px] font-mono text-yellow-400 bg-yellow-900/10 border border-yellow-900/30 px-1.5 py-0.5 rounded">{t}</span>
          ))}
        </div>
      )}

      {/* Explanation footer */}
      <p className="text-[9px] text-gray-600 font-mono mt-2 leading-relaxed">
        {caught
          ? `Behavioral burst detected — ${sim.events_simulated} events in ~${(sim.events_simulated * 0.5).toFixed(0)}s triggered anomaly detection even if individual payloads bypassed the firewall.`
          : missed
          ? "Session not flagged by behavioral model. Attacker could iterate through payloads without triggering UEBA. Consider lowering burst_score threshold or retraining on adversarial data."
          : null
        }
      </p>
    </div>
  );
}


function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center py-4 gap-2">
      <div className="w-4 h-4 border-[2px] border-indigo-500/25 border-t-indigo-500 rounded-full animate-spin" />
      <span className="text-[10px] font-mono text-gray-600 tracking-widest">FETCHING TELEMETRY...</span>
    </div>
  );
}

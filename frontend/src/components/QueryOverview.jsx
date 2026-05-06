import React, { useState, useMemo } from "react";
import PropTypes from "prop-types";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";

const timeFilters = ["24H", "7D", "30D"];

// Custom Tooltip for Area Chart
const CustomAreaTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const allowed = payload.find(p => p.dataKey === "allowed")?.value || 0;
    const blocked = payload.find(p => p.dataKey === "blocked")?.value || 0;
    const total = allowed + blocked;
    const blockRate = total > 0 ? ((blocked / total) * 100).toFixed(1) : 0;
    
    let insightText = null;
    if (blocked > allowed && blocked > 0) {
      insightText = "Elevated threat activity";
    }

    return (
      <div className="bg-gray-900/95 border border-gray-700/50 rounded-lg p-3 shadow-xl backdrop-blur-sm min-w-[180px]">
        <p className="text-gray-400 text-xs mb-2">{label}</p>
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-sm">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
              <span className="text-gray-300">Allowed</span>
            </span>
            <span className="font-semibold text-emerald-400">{allowed}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"></span>
              <span className="text-gray-300">Blocked</span>
            </span>
            <span className="font-semibold text-rose-400">{blocked}</span>
          </div>
        </div>
        <div className="mt-3 pt-2 border-t border-gray-700/50 flex justify-between items-center text-xs">
          <span className="text-gray-500">Block Rate</span>
          <span className="text-gray-300 font-medium">{blockRate}%</span>
        </div>
        {insightText && (
          <div className="mt-2 text-[10px] font-medium text-rose-400/90 bg-rose-500/10 px-2 py-1 rounded">
            ⚡ {insightText}
          </div>
        )}
      </div>
    );
  }
  return null;
};

export default function QueryOverview({ logs = [] }) {
  const [timeFilter, setTimeFilter] = useState("24H");

  // Process data based on time filter
  const { chartData, totalStats, insight } = useMemo(() => {
    // 1. Determine cutoff time
    const now = Date.now();
    let cutoff = now;
    let bucketSizeMs = 60 * 1000; // default 1 min
    
    if (timeFilter === "1H") {
      cutoff = now - 60 * 60 * 1000;
      bucketSizeMs = 60 * 1000; // 1 min buckets
    } else if (timeFilter === "24H") {
      cutoff = now - 24 * 60 * 60 * 1000;
      bucketSizeMs = 60 * 60 * 1000; // 1 hour buckets
    } else if (timeFilter === "7D") {
      cutoff = now - 7 * 24 * 60 * 60 * 1000;
      bucketSizeMs = 24 * 60 * 60 * 1000; // 1 day buckets
    } else {
      cutoff = now - 30 * 24 * 60 * 60 * 1000;
      bucketSizeMs = 24 * 60 * 60 * 1000; // 1 day buckets
    }

    // Filter logs
    const filteredLogs = logs.filter(l => {
      if (!l.timestamp) return true; // If no timestamp, don't filter it out
      const ts = new Date(l.timestamp).getTime();
      if (!ts || isNaN(ts)) return true;
      return ts >= cutoff;
    });

    // 2. Bucket the logs
    const buckets = {};
    let totalAllowed = 0;
    let totalBlocked = 0;

    filteredLogs.forEach(l => {
      let safeTs = now;
      if (l.timestamp) {
        const parsed = new Date(l.timestamp).getTime();
        if (parsed && !isNaN(parsed)) safeTs = parsed;
      }
      
      const bucketTime = Math.floor(safeTs / bucketSizeMs) * bucketSizeMs;
      
      if (!buckets[bucketTime]) {
        buckets[bucketTime] = { time: bucketTime, allowed: 0, blocked: 0 };
      }
      
      const isBlocked = l.decision?.toUpperCase() === "BLOCK" || l.decision?.toUpperCase() === "QUARANTINE";
      if (isBlocked) {
        buckets[bucketTime].blocked += 1;
        totalBlocked += 1;
      } else {
        buckets[bucketTime].allowed += 1;
        totalAllowed += 1;
      }
    });

    // Sort and format data for Recharts
    const sortedData = Object.values(buckets).sort((a, b) => a.time - b.time).map(b => {
      const date = new Date(b.time);
      let label = "";
      if (timeFilter === "1H") label = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      else if (timeFilter === "24H") label = date.toLocaleTimeString([], { hour: '2-digit' });
      else label = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      
      return { ...b, label };
    });

    // dummy items to make the chart look like a continuous area
    if (sortedData.length === 1) {
      const dummy = { ...sortedData[0], time: sortedData[0].time - bucketSizeMs, label: "Previous", allowed: 0, blocked: 0 };
      sortedData.unshift(dummy);
    } else if (sortedData.length === 0) {
      sortedData.push({ time: now, label: "Now", allowed: 0, blocked: 0 });
    }

    const blockRate = totalAllowed + totalBlocked > 0 
      ? ((totalBlocked / (totalAllowed + totalBlocked)) * 100) 
      : 0;

    // Determine high-level insight
    let insightStr = "Traffic flowing normally";
    let insightType = "normal";
    
    if (sortedData.length >= 2) {
      const latest = sortedData[sortedData.length - 1];
      const prev = sortedData[sortedData.length - 2];
      
      if (latest.blocked > 0 && latest.blocked > prev.blocked * 1.5) {
        const increase = Math.round(((latest.blocked - prev.blocked) / (prev.blocked || 1)) * 100);
        insightStr = `Blocked traffic spiked by ${increase}% recently`;
        insightType = "danger";
      } else if (blockRate > 30) {
        insightStr = `High block rate detected (${blockRate.toFixed(1)}%)`;
        insightType = "warning";
      }
    }

    return {
      chartData: sortedData,
      totalStats: { total: totalAllowed + totalBlocked, allowed: totalAllowed, blocked: totalBlocked, blockRate },
      insight: { text: insightStr, type: insightType }
    };
  }, [logs, timeFilter]);

  const donutData = [
    { name: "Allowed", value: totalStats.allowed, color: "#10b981" },
    { name: "Blocked", value: totalStats.blocked, color: "#f43f5e" }
  ];

  return (
    <div className="h-full p-5 bg-[#111827] border border-gray-800 rounded-2xl shadow-2xl flex flex-col relative overflow-hidden group transition-all duration-500 hover:border-gray-700 min-h-0">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-blue-500/5 blur-[80px] rounded-full pointer-events-none transition-opacity duration-1000"></div>

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 relative z-10 gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-lg font-semibold text-gray-100 tracking-tight flex items-center gap-2">
            Query Overview
            <span className="relative flex h-2 w-2">
              {insight.type === "danger" && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${insight.type === "danger" ? "bg-rose-500" : insight.type === "warning" ? "bg-yellow-500" : "bg-emerald-500"}`}></span>
            </span>
          </h2>
          <div className="text-xs text-gray-400 font-medium bg-gray-800/50 px-2.5 py-1 rounded-md border border-gray-700/50 whitespace-nowrap">
            {insight.text}
          </div>
        </div>

        {/* Time Filters */}
        <div className="flex bg-gray-900/80 p-1 rounded-lg border border-gray-800 backdrop-blur-md shrink-0">
          {timeFilters.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeFilter(tf)}
              className={`text-[10px] font-medium px-2.5 py-1 rounded-md transition-all duration-300 ${
                timeFilter === tf 
                  ? "bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.4)]" 
                  : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Charts Section */}
      <div className="flex-1 flex gap-4 min-h-0 relative z-10 items-stretch">
        {/* Main Area Chart */}
        <div className="flex-1 min-w-0 relative">
          <div className="absolute inset-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAllowed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="colorBlocked" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.3} />
                <XAxis 
                  dataKey="label" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6b7280', fontSize: 10 }} 
                  dy={10}
                  minTickGap={20}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6b7280', fontSize: 10 }} 
                />
                <Tooltip content={<CustomAreaTooltip />} cursor={{ stroke: '#4b5563', strokeWidth: 1, strokeDasharray: '4 4' }} />
                
                <Area 
                  type="monotone" 
                  dataKey="allowed" 
                  stackId="1" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  fill="url(#colorAllowed)" 
                  activeDot={{ r: 4, strokeWidth: 0, fill: '#10b981', style: { filter: 'drop-shadow(0px 0px 4px rgba(16,185,129,0.8))' } }}
                />
                <Area 
                  type="monotone" 
                  dataKey="blocked" 
                  stackId="1" 
                  stroke="#f43f5e" 
                  strokeWidth={2}
                  fill="url(#colorBlocked)" 
                  activeDot={{ r: 4, strokeWidth: 0, fill: '#f43f5e', style: { filter: 'drop-shadow(0px 0px 4px rgba(244,63,94,0.8))' } }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Chart & Stats Sidebar */}
        <div className="w-28 shrink-0 flex flex-col items-center justify-between border-l border-gray-800/80 pl-4 py-2">
          <div className="relative w-full aspect-square flex items-center justify-center mb-3 group-hover:scale-105 transition-transform duration-500">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius="70%"
                  outerRadius="100%"
                  stroke="none"
                  paddingAngle={5}
                  dataKey="value"
                  animationDuration={1500}
                >
                  {donutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "8px", fontSize: "12px", color: "#fff" }}
                  itemStyle={{ color: "#fff" }}
                  formatter={(value) => [value, "Count"]}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Label for Donut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-bold text-gray-200 leading-none">{totalStats.blockRate.toFixed(0)}%</span>
            </div>
          </div>
          
          <div className="w-full space-y-2">
            <div className="text-center bg-gray-900/50 rounded-lg p-2 border border-gray-800/50 transition-colors hover:bg-gray-800/80">
              <div className="text-[10px] text-gray-500 font-medium">Total</div>
              <div className="text-base font-bold text-gray-300">{totalStats.total}</div>
            </div>
            <div className="text-center bg-gray-900/50 rounded-lg p-2 border border-gray-800/50 transition-colors hover:bg-emerald-900/10 hover:border-emerald-900/30">
              <div className="text-[10px] text-emerald-500/80 font-medium">Allowed</div>
              <div className="text-base font-bold text-emerald-400">{totalStats.allowed}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

QueryOverview.propTypes = {
  logs: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      decision: PropTypes.string,
      timestamp: PropTypes.string,
    })
  ),
};

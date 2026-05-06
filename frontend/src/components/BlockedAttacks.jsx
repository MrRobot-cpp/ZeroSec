import PropTypes from "prop-types";

// Premium SVG Icons mapping for threats
const THREAT_CONFIGS = {
  "ml anomaly": { 
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M12 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/><path d="M19 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/><path d="M5 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/><path d="M12 6v8"/><path d="M5.5 15.5l6.5-5"/><path d="M18.5 15.5l-6.5-5"/></svg>, 
    color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/30", bar: "#8b5cf6", glow: "rgba(139,92,246,0.6)", label: "AI Anomaly" 
  },
  "prompt injection": { 
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>, 
    color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30", bar: "#f43f5e", glow: "rgba(244,63,94,0.6)", label: "Prompt Injection" 
  },
  "jailbreak": { 
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>, 
    color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", bar: "#f97316", glow: "rgba(249,115,22,0.6)", label: "Jailbreak Attempt" 
  },
  "sql": { 
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>, 
    color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", bar: "#3b82f6", glow: "rgba(59,130,246,0.6)", label: "SQL Injection" 
  },
  "rate limit": { 
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>, 
    color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", bar: "#eab308", glow: "rgba(234,179,8,0.6)", label: "Rate Limit" 
  },
  "xss": { 
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="16" height="14" x="4" y="8" rx="2"/><path d="M12 16v.01"/></svg>, 
    color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", bar: "#10b981", glow: "rgba(16,185,129,0.6)", label: "XSS Attack" 
  },
};

const getThreatConfig = (name) => {
  const lowerName = name.toLowerCase();
  for (const [key, config] of Object.entries(THREAT_CONFIGS)) {
    if (lowerName.includes(key)) return config;
  }
  return { 
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, 
    color: "text-gray-400", bg: "bg-gray-800/50", border: "border-gray-700/50", bar: "#6b7280", glow: "rgba(107,114,128,0.4)", label: name 
  };
};

export default function BlockedAttacks({ logs }) {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const recentLogs = logs.filter((l) => {
    // If timestamp is missing, assume it's "now" to avoid dropping simulated data
    const logTime = l.timestamp ? new Date(l.timestamp) : now;
    return logTime >= last24h && l.decision?.toUpperCase() === "BLOCK";
  });

  // Group by attack category
  const attackCounts = {};
  recentLogs.forEach((l) => {
    let category;
    if (l.is_anomaly || (l.stopped_by || "").toLowerCase().includes("anomaly")) {
      category = "ML Anomaly";
    } else {
      // Clean up string like "Firewall - Prompt Injection"
      const rawReason = (l.reason || "Unknown").replace("Firewall - ", "").replaceAll("_", " ");
      category = rawReason.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
    attackCounts[category] = (attackCounts[category] || 0) + 1;
  });

  const totalBlocked = recentLogs.length;

  // Sort by count descending
  const entries = Object.entries(attackCounts).sort(([, aVal], [, bVal]) => bVal - aVal);
  const maxCount = entries.length > 0 ? entries[0][1] : 1;

  // Determine threat level for styling
  const threatLevel = totalBlocked > 50 ? "high" : totalBlocked > 10 ? "medium" : "low";
  const headerColor = threatLevel === "high" ? "text-rose-500" : threatLevel === "medium" ? "text-orange-400" : "text-emerald-400";
  const headerGlow = threatLevel === "high" ? "rgba(244,63,94,0.4)" : threatLevel === "medium" ? "rgba(249,115,22,0.4)" : "rgba(16,185,129,0.4)";

  return (
    <div className="h-full p-5 bg-[#111827] border border-gray-800 rounded-2xl shadow-2xl flex flex-col relative overflow-hidden group transition-all duration-500 hover:border-gray-700 min-h-0">
      {/* Dynamic Background Glow based on threat level */}
      <div 
        className="absolute top-0 right-0 w-64 h-64 blur-[100px] rounded-full pointer-events-none transition-all duration-1000 opacity-20"
        style={{ backgroundColor: threatLevel === "high" ? "#f43f5e" : threatLevel === "medium" ? "#f97316" : "#10b981" }}
      ></div>

      <h2 className="text-lg font-semibold mb-4 text-gray-100 tracking-tight flex items-center justify-between relative z-10 shrink-0">
        Blocked Attacks
        <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border border-gray-700/50 bg-gray-900/80 text-gray-400">
          Last 24h
        </span>
      </h2>

      {totalBlocked === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 relative z-10">
          <div className="w-16 h-16 rounded-full bg-gray-800/50 border border-gray-700/50 flex items-center justify-center mb-4 shadow-inner">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 opacity-50"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <p className="font-medium text-gray-300">No threats detected</p>
          <p className="text-xs mt-1 text-gray-500">Perimeter is secure</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col relative z-10 min-h-0">
          {/* Top summary metric */}
          <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-800/80 shrink-0">
            <div className="flex-shrink-0 relative">
              <div className={`text-5xl font-black ${headerColor}`} style={{ textShadow: `0 0 25px ${headerGlow}` }}>
                {totalBlocked}
              </div>
            </div>
            <div>
              <div className="text-sm font-bold text-gray-100">Threats Neutralized</div>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  threatLevel === "high" ? "bg-rose-500/20 text-rose-400" : threatLevel === "medium" ? "bg-orange-500/20 text-orange-400" : "bg-emerald-500/20 text-emerald-400"
                }`}>
                  {threatLevel} volume
                </span>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                  {entries.length} Vector{entries.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          </div>

          {/* List of threats */}
          <div className="space-y-2.5 overflow-y-auto pr-1 custom-scrollbar flex-1 pb-2">
            {entries.map(([name, count]) => {
              const config = getThreatConfig(name);
              const percentage = Math.round((count / totalBlocked) * 100);
              const barWidth = Math.max(5, (count / maxCount) * 100);
              
              return (
                <div key={name} className="flex flex-col p-2.5 rounded-xl bg-gray-900/40 border border-gray-800/60 hover:bg-gray-800/50 transition-colors group/item">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.bg} ${config.border} border shadow-inner ${config.color}`}>
                        {config.icon}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-200">{config.label}</div>
                        <div className="text-[10px] text-gray-500 font-medium mt-0.5">{percentage}% of total</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${config.color}`}>{count}</div>
                    </div>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-gray-950/50 rounded-full h-1 overflow-hidden mt-0.5">
                    <div 
                      className="h-full rounded-full transition-all duration-1000 ease-out relative"
                      style={{ 
                        width: `${barWidth}%`, 
                        backgroundColor: config.bar,
                        boxShadow: `0 0 10px ${config.glow}`
                      }}
                    >
                      <div className="absolute inset-0 bg-white/20 w-full h-full animate-[pulse_2s_ease-in-out_infinite]"></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Custom Scrollbar Styles */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4b5563; }
      `}} />
    </div>
  );
}

BlockedAttacks.propTypes = {
  logs: PropTypes.arrayOf(
    PropTypes.shape({
      decision:   PropTypes.string,
      reason:     PropTypes.string,
      timestamp:  PropTypes.string,
      stopped_by: PropTypes.string,
      is_anomaly: PropTypes.bool,
    })
  ).isRequired,
};

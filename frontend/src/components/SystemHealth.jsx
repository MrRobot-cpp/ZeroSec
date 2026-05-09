import { useState, useEffect } from "react";

export default function SystemHealth() {
  const [health, setHealth] = useState({
    vectordb: "checking",
    llm: "checking",
    backend: "checking",
  });
  const [ragInfo, setRagInfo] = useState(null);

  useEffect(() => {
    checkHealth();
    // Check health every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkHealth = async () => {
    const newHealth = { ...health };

    // Check backend
    try {
      const response = await fetch("http://localhost:5200/documents", {
        method: "GET",
        signal: AbortSignal.timeout(5000)
      });
      newHealth.backend = response.ok ? "healthy" : "degraded";
    } catch (error) {
      newHealth.backend = "down";
    }

    // Check VectorDB (via documents endpoint)
    try {
      const response = await fetch("http://localhost:5200/documents", {
        signal: AbortSignal.timeout(5000)
      });
      const data = await response.json();
      newHealth.vectordb = data.documents !== undefined ? "healthy" : "degraded";
    } catch (error) {
      newHealth.vectordb = "down";
    }

    // Check LLM + VectorDB via the real RAG health endpoint
    try {
      const response = await fetch("http://localhost:5200/api/rag/health", {
        signal: AbortSignal.timeout(10000)
      });
      const data = await response.json();
      newHealth.llm = data.status === "ok" ? "healthy" : "degraded";
      newHealth.vectordb = data.status === "ok" ? "healthy" : "degraded";
      setRagInfo(data);
    } catch (error) {
      newHealth.llm = "down";
      newHealth.vectordb = "down";
      setRagInfo(null);
    }

    setHealth(newHealth);
  };

  const getStatusConfig = (status) => {
    if (status === "healthy") return { icon: "✅", color: "text-emerald-400", bg: "bg-emerald-900/10", border: "border-emerald-500/30", dot: "bg-emerald-500", glow: "shadow-[0_0_8px_rgba(16,185,129,0.5)]" };
    if (status === "degraded") return { icon: "⚠️", color: "text-yellow-400", bg: "bg-yellow-900/10", border: "border-yellow-500/30", dot: "bg-yellow-500", glow: "shadow-[0_0_8px_rgba(234,179,8,0.5)]" };
    if (status === "down") return { icon: "❌", color: "text-rose-400", bg: "bg-rose-900/10", border: "border-rose-500/30", dot: "bg-rose-500", glow: "shadow-[0_0_8px_rgba(244,63,94,0.5)]" };
    return { icon: "🔄", color: "text-gray-400", bg: "bg-gray-800/30", border: "border-gray-700/50", dot: "bg-gray-500", glow: "shadow-none" };
  };

  const components = [
    { name: "Backend API", status: health.backend, key: "backend" },
    { name: "VectorDB", status: health.vectordb, key: "vectordb" },
    { name: "LLM Connection", status: health.llm, key: "llm" },
  ];

  const overallHealthy = components.every((c) => c.status === "healthy");
  const overallDegraded = components.some((c) => c.status === "degraded");
  const overallDown = components.some((c) => c.status === "down");

  const overallStatus = overallDown ? "down" : overallDegraded ? "degraded" : overallHealthy ? "healthy" : "checking";
  const overallStyle = getStatusConfig(overallStatus);

  return (
    <div className="h-full p-5 bg-[#111827] border border-gray-800 rounded-2xl shadow-2xl flex flex-col relative overflow-hidden group transition-all duration-500 hover:border-gray-700 min-h-0">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-40 h-40 blur-[80px] rounded-full pointer-events-none transition-opacity duration-1000 opacity-10" style={{ backgroundColor: overallStyle.dot ? overallStyle.dot.replace('bg-', '') : '#111827' }}></div>

      <h2 className="text-lg font-semibold mb-4 text-gray-100 tracking-tight flex items-center justify-between relative z-10 shrink-0">
        System Health
        {overallStatus === "checking" && (
          <span className="text-[10px] text-gray-400 animate-pulse bg-gray-800/50 px-2 py-0.5 rounded border border-gray-700">Checking...</span>
        )}
      </h2>

      <div className={`text-center mb-5 p-4 rounded-xl ${overallStyle.bg} ${overallStyle.border} border backdrop-blur-sm relative z-10 overflow-hidden shrink-0`}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 50% -20%, currentColor 0%, transparent 70%)', color: 'inherit' }}></div>
        <div className="flex items-center justify-center gap-3">
          <span className="text-3xl drop-shadow-md">{overallStyle.icon}</span>
          <div className="text-left">
            <div className={`text-lg font-bold ${overallStyle.color} capitalize tracking-tight`}>
              {overallStatus === "healthy" ? "All Systems Operational" : overallStatus}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">Automated diagnostics running</div>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-2.5 relative z-10 min-h-0 overflow-y-auto custom-scrollbar pr-1 pb-4">
        {components.map((component) => {
          const style = getStatusConfig(component.status);
          return (
            <div
              key={component.key}
              className="flex justify-between items-center p-3 rounded-xl bg-gray-900/40 border border-gray-800/80 transition-colors hover:bg-gray-800/60 shrink-0"
            >
              <span className="text-sm font-medium text-gray-300">{component.name}</span>
              <div className="flex items-center gap-2 bg-gray-900/80 px-2.5 py-1 rounded-md border border-gray-700/50">
                <span className={`w-2 h-2 rounded-full ${style.dot} ${style.glow}`}></span>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${style.color}`}>
                  {component.status}
                </span>
              </div>
            </div>
          );
        })}
        {ragInfo && (
          <div className="mt-4 p-3 rounded-xl bg-gradient-to-br from-gray-800/40 to-gray-900/60 border border-gray-700/50 backdrop-blur-sm space-y-2 relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 p-2 opacity-10 text-3xl">🧠</div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">RAG Engine</div>
            <div className="flex justify-between items-center border-b border-gray-700/30 pb-1.5">
              <span className="text-xs text-gray-400">Mode</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${ragInfo.provider === "external" ? "bg-blue-900/20 text-blue-400 border border-blue-500/20" : "bg-emerald-900/20 text-emerald-400 border border-emerald-500/20"}`}>
                {ragInfo.provider === "external" ? "EXTERNAL API" : "LOCAL"}
              </span>
            </div>
            {ragInfo.llm && (
              <div className="flex justify-between items-center pb-1.5">
                <span className="text-xs text-gray-400">Model</span>
                <span className="text-xs text-gray-300 font-mono bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800">{ragInfo.llm}</span>
              </div>
            )}
            {ragInfo.vector_db && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Database</span>
                <span className="text-xs text-gray-300 font-mono bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800">{ragInfo.vector_db}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4b5563; }
      `}} />
    </div>
  );
}

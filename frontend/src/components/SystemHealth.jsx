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

  const getStatusIcon = (status) => {
    if (status === "healthy") return { icon: "✅", color: "text-green-400", bg: "bg-green-900/30" };
    if (status === "degraded") return { icon: "⚠️", color: "text-yellow-400", bg: "bg-yellow-900/30" };
    if (status === "down") return { icon: "❌", color: "text-red-400", bg: "bg-red-900/30" };
    return { icon: "🔄", color: "text-gray-400", bg: "bg-gray-700/30" };
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
  const overallStyle = getStatusIcon(overallStatus);

  return (
    <div className="h-full p-3 bg-gray-800 border border-gray-700 rounded-xl shadow flex flex-col overflow-hidden justify-center">
      <h2 className="text-base font-semibold mb-3 text-white text-center">System Health</h2>

      <div className={`text-center mb-3 p-3 rounded-lg ${overallStyle.bg}`}>
        <div className="text-4xl mb-1">{overallStyle.icon}</div>
        <div className={`text-base font-semibold ${overallStyle.color} capitalize`}>
          {overallStatus}
        </div>
      </div>

      <div className="flex-1 space-y-2.5">
        {components.map((component) => {
          const style = getStatusIcon(component.status);
          return (
            <div
              key={component.key}
              className={`flex justify-between items-center p-3 rounded-lg ${style.bg} border border-gray-700`}
            >
              <span className="text-sm text-gray-300">{component.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-lg">{style.icon}</span>
                <span className={`text-sm font-semibold ${style.color} capitalize`}>
                  {component.status}
                </span>
              </div>
            </div>
          );
        })}
        {ragInfo && (
          <div className="mt-1 px-3 py-2 rounded-lg bg-gray-700/40 border border-gray-700 text-xs text-gray-400 space-y-1">
            <div className="flex justify-between">
              <span>Mode</span>
              <span className={`font-medium ${ragInfo.provider === "external" ? "text-blue-400" : "text-green-400"}`}>
                {ragInfo.provider === "external" ? "External API" : "Local"}
              </span>
            </div>
            {ragInfo.llm && (
              <div className="flex justify-between">
                <span>LLM</span>
                <span className="text-gray-300 font-mono">{ragInfo.llm}</span>
              </div>
            )}
            {ragInfo.vector_db && (
              <div className="flex justify-between">
                <span>Vector DB</span>
                <span className="text-gray-300 font-mono">{ragInfo.vector_db}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

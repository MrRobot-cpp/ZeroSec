import { useState, useEffect } from "react";

export default function SystemHealth() {
  const [health, setHealth] = useState({
    vectordb: "checking",
    llm: "checking",
    backend: "checking",
  });

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

    // Check LLM (via query endpoint with test)
    try {
      const response = await fetch("http://localhost:5200/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: "health_check" }),
        signal: AbortSignal.timeout(10000)
      });
      newHealth.llm = response.ok ? "healthy" : "degraded";
    } catch (error) {
      newHealth.llm = "down";
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
      </div>
    </div>
  );
}

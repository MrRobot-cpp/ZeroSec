"use client";
import Sidebar from "./Sidebar";
import SecurityScore from "./SecurityScore";
import TopAlerts from "./TopAlerts";
import QueryOverview from "./QueryOverview";
import BlockedAttacks from "./BlockedAttacks";
import DataIntakeStatus from "./DataIntakeStatus";
import SystemHealth from "./SystemHealth";
import useFirewall from "@/hooks/useFirewall";
import useDashboard from "@/hooks/useDashboard";

export default function Dashboard() {
  const { logs = [] } = useFirewall();
  const { data: dashboardData, loading, error, refresh, lastUpdated } = useDashboard();

  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
      <Sidebar />
      <main className="flex-1 p-6 flex flex-col overflow-hidden">
        <div className="mb-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            {lastUpdated && (
              <p className="text-sm text-gray-400 mt-1">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="animate-spin">⟳</span>
                Loading...
              </>
            ) : (
              <>
                <span>🔄</span>
                Refresh
              </>
            )}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
            <p className="font-medium">Error loading dashboard data</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Top Row: 3 Components */}
        <div className="grid grid-cols-3 gap-4 flex-1 mb-4">
          <SecurityScore
            logs={logs}
            securityStats={dashboardData.security}
          />
          <TopAlerts
            logs={logs}
            alerts={dashboardData.alerts}
          />
          <QueryOverview
            logs={logs}
            userStats={dashboardData.users}
          />
        </div>

        {/* Bottom Row: 3 Components */}
        <div className="grid grid-cols-3 gap-4 flex-1">
          <BlockedAttacks
            logs={logs}
            securityStats={dashboardData.security}
          />
          <DataIntakeStatus
            documentStats={dashboardData.documents}
          />
          <SystemHealth
            overview={dashboardData.overview}
          />
        </div>
      </main>
    </div>
  );
}

"use client";
import Sidebar from "./Sidebar";
import SecurityScore from "./SecurityScore";
import TopAlerts from "./TopAlerts";
import QueryOverview from "./QueryOverview";
import BlockedAttacks from "./BlockedAttacks";
import DataIntakeStatus from "./DataIntakeStatus";
import SystemHealth from "./SystemHealth";
import useFirewall from "@/hooks/useFirewall";

export default function Dashboard() {
  const { logs = [] } = useFirewall();

  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
      <Sidebar />
      <main className="flex-1 p-6 flex flex-col overflow-hidden">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        </div>

        {/* Top Row: 3 Components */}
        <div className="grid grid-cols-3 gap-4 flex-1 mb-4">
          <SecurityScore logs={logs} />
          <TopAlerts logs={logs} />
          <QueryOverview logs={logs} />
        </div>

        {/* Bottom Row: 3 Components */}
        <div className="grid grid-cols-3 gap-4 flex-1">
          <BlockedAttacks logs={logs} />
          <DataIntakeStatus />
          <SystemHealth />
        </div>
      </main>
    </div>
  );
}

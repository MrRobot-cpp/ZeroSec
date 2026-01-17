"use client";
import Sidebar from "./Sidebar";
import MetricsRow from "./MetricsRow";
import VerdictPanel from "./VerdictPanel";
import LogsTable from "./LogsTable";
import useFirewall from "@/hooks/useFirewall";

export default function Dashboard() {
  const { verdict, responseText, logs = [] } = useFirewall(); // default empty array

  return (
    <div className="flex min-h-screen bg-neutral-950 text-white">
      <Sidebar />
      <main className="flex-1 p-6 space-y-6">
        {/* Metrics charts */}
        <MetricsRow logs={logs} />

        {/* Verdict panel + logs table */}
        <div className="grid grid-cols-2 gap-6">
          <VerdictPanel verdict={verdict} responseText={responseText} logs={logs} />
          <LogsTable logs={logs} />
        </div>
      </main>
    </div>
  );
}

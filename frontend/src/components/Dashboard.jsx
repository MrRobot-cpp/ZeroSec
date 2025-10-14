"use client";
import Sidebar from "./Sidebar";
import MetricsRow from "./MetricsRow";
import QueryPanel from "./QueryPanel";
import VerdictPanel from "./VerdictPanel";
import LogsTable from "./LogsTable";
import useFirewall from "@/hooks/useFirewall";

export default function Dashboard() {
const {
    query,
    setQuery,
    verdict,
    responseText,
    logs,
    sendQuery,
    maliciousTriggers,
} = useFirewall();

return (
    <div className="flex min-h-screen bg-neutral-950 text-white">
    <Sidebar />
    <main className="flex-1 p-6 space-y-6">
        <MetricsRow logs={logs} />
        <div className="grid grid-cols-3 gap-6">
        <QueryPanel
            query={query}
            setQuery={setQuery}
            sendQuery={sendQuery}
            maliciousTriggers={maliciousTriggers}
        />
        <VerdictPanel
            verdict={verdict}
            responseText={responseText}
            setQuery={setQuery}
        />
        <LogsTable logs={logs} />
        </div>
    </main>
    </div>
);
}

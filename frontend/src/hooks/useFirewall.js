import { useState } from "react";

export default function useFirewall() {
const [query, setQuery] = useState("");
const [verdict, setVerdict] = useState(null);
const [responseText, setResponseText] = useState("");
const [logs, setLogs] = useState([]);

const maliciousTriggers = ["hack", "password", "drop table", "select", "delete", "—injection"];

function evaluateQuery(q) {
    const lower = q.toLowerCase();
    return maliciousTriggers.some((t) => lower.includes(t));
}

function sendQuery() {
    if (!query.trim()) return;
    const isBlocked = evaluateQuery(query);
    const time = new Date().toLocaleString();

    const newLog = {
    id: logs.length + 1,
    time,
    query,
    verdict: isBlocked ? "BLOCKED" : "SAFE",
    action: isBlocked ? "Blocked" : "Returned (sanitized)",
    };

    setLogs([newLog, ...logs]);
    setVerdict(isBlocked ? "blocked" : "safe");
    setResponseText(
    isBlocked
        ? "⚠️ Query blocked by ZeroSec Firewall."
        : "Here is your safe answer (mocked):\n\n- Summary: Relevant info returned.\n- Notes: No sensitive data detected."
    );
    setQuery("");
}

return {
    query,
    setQuery,
    verdict,
    responseText,
    logs,
    sendQuery,
    maliciousTriggers,
};
}

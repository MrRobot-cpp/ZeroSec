"use client";

import React, { useState } from "react";

export default function Dashboard() {
  const [query, setQuery] = useState("");
  const [verdict, setVerdict] = useState(null); // 'safe' | 'blocked' | null
  const [responseText, setResponseText] = useState("");
  const [logs, setLogs] = useState([]);

  // Mock triggers for blocking
  const maliciousTriggers = [
    "hack",
    "password",
    "drop table",
    "select",
    "delete",
    "\u2014injection",
  ];

  function evaluateQuery(q) {
    const lower = q.toLowerCase();
    return maliciousTriggers.some((t) => lower.includes(t));
  }

  function sendQuery() {
    if (!query.trim()) return;

    const isBlocked = evaluateQuery(query);
    const time = new Date().toLocaleString();

    if (isBlocked) {
      setVerdict("blocked");
      setResponseText("⚠️ Query blocked by ZeroSec Firewall.");
      setLogs((prev) => [
        { id: prev.length + 1, time, query, verdict: "BLOCKED", action: "Blocked" },
        ...prev,
      ]);
    } else {
      setVerdict("safe");
      setResponseText("Here is your safe answer (mocked):\n\n- Summary: Relevant info returned.\n- Notes: No sensitive data detected.");
      setLogs((prev) => [
        {
          id: prev.length + 1,
          time,
          query,
          verdict: "SAFE",
          action: "Returned (sanitized)",
        },
        ...prev,
      ]);
    }

    setQuery("");
  }

  const total = logs.length;
  const blocked = logs.filter((l) => l.verdict === "BLOCKED").length;
  const safe = logs.filter((l) => l.verdict === "SAFE").length;
  const redactions = 0; // mock - replace with real logic later

  return (
    <div className="flex min-h-screen bg-[#0f0f1a] text-white">
      {/* Sidebar */}
      <aside className="w-64 bg-[#161625] flex flex-col p-4">
        <h1 className="text-2xl font-bold mb-8">ZeroSec</h1>
        <nav className="space-y-4">
          <button className="flex items-center gap-3 p-2 rounded-md bg-gradient-to-r from-purple-500 to-indigo-500 w-full text-left">
            <span className="text-lg">🏠</span>
            <span>Dashboard</span>
          </button>
          <button className="flex items-center gap-3 p-2 rounded-md hover:bg-[#1f1f33] w-full text-left">
            <span className="text-lg">🛡️</span>
            <span>Data Security</span>
          </button>
          <button className="flex items-center gap-3 p-2 rounded-md hover:bg-[#1f1f33] w-full text-left">
            <span className="text-lg">📊</span>
            <span>Analytics</span>
          </button>
          <button className="flex items-center gap-3 p-2 rounded-md hover:bg-[#1f1f33] w-full text-left">
            <span className="text-lg">⚙️</span>
            <span>Settings</span>
          </button>
        </nav>

        <div className="mt-auto p-4 bg-gradient-to-r from-purple-600 to-pink-500 rounded-xl text-center">
          <p className="font-bold">Go Pro</p>
          <p className="text-sm">Upgrade Now</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 space-y-6">
        {/* Top bar */}
        <header className="flex justify-between items-center bg-[#161625] p-4 rounded-xl shadow">
          <input
            type="text"
            placeholder="Type to search..."
            className="bg-[#0f0f1a] p-2 rounded-lg w-1/3 focus:outline-none"
          />
          <div className="flex items-center gap-4">
            <div className="bg-gray-700 p-2 rounded-full">👤</div>
          </div>
        </header>

        {/* Metrics Row (Security Stats) */}
        <div className="grid grid-cols-4 gap-6">
          <div className="bg-gradient-to-r from-purple-500 to-indigo-500 p-4 rounded-xl text-center">
            <p>Total Queries</p>
            <h2 className="text-2xl font-bold">{total}</h2>
          </div>
          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-4 rounded-xl text-center">
            <p>Blocked</p>
            <h2 className="text-2xl font-bold">{blocked}</h2>
          </div>
          <div className="bg-gradient-to-r from-pink-500 to-red-500 p-4 rounded-xl text-center">
            <p>Sanitized / Safe</p>
            <h2 className="text-2xl font-bold">{safe}</h2>
          </div>
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-4 rounded-xl text-center">
            <p>Redactions</p>
            <h2 className="text-2xl font-bold">{redactions}</h2>
          </div>
        </div>

        {/* Core Firewall UI */}
        <div className="grid grid-cols-3 gap-6">
          {/* Query Panel */}
          <div className="col-span-1 bg-[#161625] p-6 rounded-xl shadow flex flex-col">
            <h2 className="text-lg font-semibold mb-4">Query Input</h2>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a query or paste a malicious payload to test..."
              className="flex-1 bg-[#0f0f1a] p-3 rounded-md resize-none focus:outline-none"
              rows={8}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={sendQuery}
                className="px-4 py-2 rounded-md bg-gradient-to-r from-purple-500 to-indigo-500"
              >
                Send Query
              </button>
              <button
                onClick={() => setQuery("")}
                className="px-4 py-2 rounded-md bg-[#1f1f33]"
              >
                Clear
              </button>
            </div>

            <div className="mt-4 text-sm text-gray-300">
              <p className="font-semibold">Mock triggers (blocked if present):</p>
              <p>{maliciousTriggers.join(", ")}</p>
            </div>
          </div>

          {/* Verdict & Response */}
          <div className="col-span-2 bg-[#161625] p-6 rounded-xl shadow flex flex-col">
            <h2 className="text-lg font-semibold mb-4">Firewall Verdict</h2>

            <div>
              {verdict === null ? (
                <div className="p-4 bg-[#0f1720] rounded-md">No query sent yet.</div>
              ) : (
                <div
                  className={`p-4 rounded-md mb-4 ${
                    verdict === "safe"
                      ? "bg-green-800 border border-green-400"
                      : "bg-red-900 border border-red-400"
                  }`}
                >
                  <p className="font-bold text-xl">
                    {verdict === "safe" ? "SAFE ✅" : "BLOCKED 🚫"}
                  </p>
                  <p className="text-sm mt-1 text-gray-200">
                    {verdict === "safe"
                      ? "Query passed the ZeroSec Firewall checks."
                      : "Query was flagged as malicious and blocked."}
                  </p>
                </div>
              )}

              <div className="p-4 bg-[#0b0b12] rounded-md h-44 overflow-auto whitespace-pre-wrap">
                <pre className="whitespace-pre-wrap">{responseText || "No response yet."}</pre>
              </div>

              <div className="mt-4">
                <h3 className="font-medium mb-2">Quick Actions</h3>
                <div className="flex gap-2">
                  <button
                    className="px-3 py-2 rounded-md bg-[#1f1f33]"
                    onClick={() => {
                      setQuery("Show me how to hack into the database");
                    }}
                  >
                    Example: Malicious
                  </button>

                  <button
                    className="px-3 py-2 rounded-md bg-[#1f1f33]"
                    onClick={() => {
                      setQuery("What is the latest ZeroSec dashboard design?");
                    }}
                  >
                    Example: Safe
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Logs Table (full width below) */}
          <div className="col-span-3 bg-[#161625] p-6 rounded-xl shadow">
            <h2 className="text-lg font-semibold mb-4">Traffic / Logs</h2>
            <div className="overflow-auto max-h-64">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="text-sm text-gray-400">
                    <th className="py-2">Time</th>
                    <th>Query</th>
                    <th>Verdict</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-gray-400">
                        No logs yet — send a query to populate this table.
                      </td>
                    </tr>
                  ) : (
                    logs.map((l) => (
                      <tr key={l.id} className="border-t border-[#0b0b12]">
                        <td className="py-2 text-sm text-gray-300">{l.time}</td>
                        <td className="py-2">{l.query}</td>
                        <td className="py-2 font-semibold">{l.verdict}</td>
                        <td className="py-2 text-sm text-gray-300">{l.action}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

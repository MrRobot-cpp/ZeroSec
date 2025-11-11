import PropTypes from "prop-types";

export default function VerdictPanel({ verdict, logs, responseText }) {
  // Get the last log from the live stream
  const lastLogRaw = logs.length > 0 ? logs[0] : null;

  // Hard-coded PII check
  let lastLog = lastLogRaw;
  if (lastLogRaw && lastLogRaw.query) {
    const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
    const phoneRegex = /\b\d{10,15}\b/; // simple phone check
    if (emailRegex.test(lastLogRaw.query) || phoneRegex.test(lastLogRaw.query)) {
      lastLog = {
        ...lastLogRaw,
        decision: "BLOCK",
        reason: "PII detected",
      };
    }
  }

  return (
    <div className="col-span-2 gap-3 bg-neutral-900 p-6 rounded-xl shadow flex flex-col">
      <h2 className="text-lg font-semibold mb-4">Firewall Verdict</h2>

      {/* ===== Verdict Display ===== */}
      {!lastLog ? (
        <div className="p-4 bg-neutral-950 rounded-md text-gray-400">
          No query sent yet.
        </div>
      ) : (
        <div
          className={`p-4 rounded-md mb-4 border ${
            lastLog.decision === "ALLOW"
              ? "bg-green-800 border-green-400"
              : "bg-red-900 border-red-400"
          }`}
        >
          <p className="font-bold text-xl">
            {lastLog.decision === "ALLOW" ? "SAFE ✅" : "BLOCKED 🚫"}
          </p>
          <p className="text-sm mt-1 text-gray-200">
            {lastLog.decision === "ALLOW"
              ? "Query passed the ZeroSec Firewall checks."
              : `Query was flagged as malicious: ${lastLog.reason || "unknown"}`}
          </p>
        </div>
      )}

      {/* ===== Query Section ===== */}
      <div className="p-4 bg-neutral-950 rounded-md mb-2 h-28 overflow-auto whitespace-pre-wrap">
        <h3 className="font-semibold text-gray-300 mb-2 text-sm">🧠 Last Query</h3>
        <pre className="text-gray-400 text-sm">
          {lastLog?.query || "No query sent yet."}
        </pre>
      </div>

      {/* ===== Response Section ===== */}
      <div className="p-4 bg-neutral-950 rounded-md h-44 overflow-auto whitespace-pre-wrap">
        <h3 className="font-semibold text-gray-300 mb-2 text-sm">💬 Response</h3>
        <pre className="text-gray-400 text-sm">
          {lastLog?.decision === "BLOCK" && lastLog.reason === "PII detected"
            ? "🚫 Query blocked due to PII detection (email/phone)."
            : responseText || "No response yet."}
        </pre>
      </div>
    </div>
  );
}

// ✅ PropTypes validation
VerdictPanel.propTypes = {
  verdict: PropTypes.oneOf(["safe", "blocked", null]),
  logs: PropTypes.arrayOf(
    PropTypes.shape({
      query: PropTypes.string,
      response: PropTypes.string,
      decision: PropTypes.string,
      reason: PropTypes.string,
      timestamp: PropTypes.string,
    })
  ).isRequired,
  responseText: PropTypes.string.isRequired,
};

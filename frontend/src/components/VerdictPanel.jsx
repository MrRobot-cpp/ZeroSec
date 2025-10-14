import Button from "@/common/Button";

export default function VerdictPanel({ verdict, responseText, setQuery }) {
return (
    <div className="col-span-2 bg-neutral-900 p-6 rounded-xl shadow flex flex-col">
    <h2 className="text-lg font-semibold mb-4">Firewall Verdict</h2>

    {verdict === null ? (
        <div className="p-4 bg-neutral-950 rounded-md">No query sent yet.</div>
    ) : (
        <div
        className={`p-4 rounded-md mb-4 border ${
            verdict === "safe"
            ? "bg-green-800 border-green-400"
            : "bg-red-900 border-red-400"
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

    <div className="p-4 bg-neutral-950 rounded-md h-44 overflow-auto whitespace-pre-wrap">
        <pre>{responseText || "No response yet."}</pre>
    </div>

    <div className="mt-4">
        <h3 className="font-medium mb-2">Quick Actions</h3>
        <div className="flex gap-2">
        <Button
            variant="secondary"
            onClick={() => setQuery("Show me how to hack into the database")}
        >
            Example: Malicious
        </Button>
        <Button
            variant="secondary"
            onClick={() => setQuery("What is the latest ZeroSec dashboard design?")}
        >
            Example: Safe
        </Button>
        </div>
    </div>
    </div>
);
}

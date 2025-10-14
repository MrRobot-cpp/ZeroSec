import Button from "@/common/Button";

export default function QueryPanel({ query, setQuery, sendQuery, maliciousTriggers }) {
return (
    <div className="col-span-1 bg-neutral-900 p-6 rounded-xl shadow flex flex-col">
    <h2 className="text-lg font-semibold mb-4">Query Input</h2>
    <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Type a query or paste a malicious payload..."
        className="flex-1 bg-neutral-950 p-3 rounded-md resize-none focus:outline-none"
        rows={8}
    />
    <div className="flex gap-2 mt-4">
        <Button onClick={sendQuery} variant="primary">
        Send Query
        </Button>
        <Button onClick={() => setQuery("")} variant="secondary">
        Clear
        </Button>
    </div>
    <div className="mt-4 text-sm text-gray-300">
        <p className="font-semibold">Mock triggers (blocked if present):</p>
        <p>{maliciousTriggers.join(", ")}</p>
    </div>
    </div>
);
}

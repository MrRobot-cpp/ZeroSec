export default function LogsTable({ logs }) {
return (
    <div className="col-span-3 bg-neutral-900 p-6 rounded-xl shadow">
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
                <tr key={l.id} className="border-t border-neutral-950">
                <td className="py-2 text-sm text-gray-300">{l.time}</td>
                <td className="py-2">{l.query}</td>
                <td
                    className={`py-2 font-semibold ${
                    l.verdict === "BLOCKED" ? "text-red-400" : "text-green-400"
                    }`}
                >
                    {l.verdict}
                </td>
                <td className="py-2 text-sm text-gray-300">{l.action}</td>
                </tr>
            ))
            )}
        </tbody>
        </table>
    </div>
    </div>
);
}

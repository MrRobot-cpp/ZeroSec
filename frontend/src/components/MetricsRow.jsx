import GradientCard from "@/common/GradientCard";

export default function MetricsRow({ logs }) {
const total = logs.length;
const blocked = logs.filter((l) => l.verdict === "BLOCKED").length;
const safe = logs.filter((l) => l.verdict === "SAFE").length;
const redactions = 0;

const metrics = [
    { label: "Total Queries", value: total, gradient: "from-purple-500 to-indigo-500" },
    { label: "Blocked", value: blocked, gradient: "from-blue-500 to-cyan-500" },
    { label: "Sanitized / Safe", value: safe, gradient: "from-pink-500 to-red-500" },
    { label: "Redactions", value: redactions, gradient: "from-green-500 to-emerald-500" },
];

return (
    <div className="grid grid-cols-4 gap-6">
    {metrics.map((m) => (
        <GradientCard
        key={m.label}
        label={m.label}
        value={m.value}
        gradient={m.gradient}
        />
    ))}
    </div>
);
}

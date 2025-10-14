export default function GradientCard({ label, value, gradient }) {
const gradientMap = {
    purple: "linear-gradient(to right, #a855f7, #6366f1)",
    blue: "linear-gradient(to right, #3b82f6, #06b6d4)",
    pink: "linear-gradient(to right, #ec4899, #ef4444)",
    green: "linear-gradient(to right, #22c55e, #10b981)",
};

return (
    <div
    style={{
        background: gradientMap[gradient] || gradientMap.purple,
    }}
    className="p-4 rounded-xl text-center shadow text-white"
    >
    <p className="text-sm">{label}</p>
    <h2 className="text-2xl font-bold">{value}</h2>
    </div>
);
}

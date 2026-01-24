"use client";

export default function SubscriptionLock({ title, description, tier }) {
  const tierColors = {
    Pro: { bg: "bg-purple-900/30", border: "border-purple-500/30", badge: "bg-purple-600 text-purple-100" },
    Enterprise: { bg: "bg-blue-900/30", border: "border-blue-500/30", badge: "bg-blue-600 text-blue-100" },
  };

  const colors = tierColors[tier] || tierColors.Pro;

  return (
    <div className={`${colors.bg} border ${colors.border} rounded-lg p-4 relative overflow-hidden`}>
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-medium text-white pr-16">{title}</h4>
          <span className={`px-2 py-1 ${colors.badge} rounded text-xs font-semibold whitespace-nowrap`}>
            🔒 {tier}
          </span>
        </div>
        <p className="text-sm text-gray-300">{description}</p>
      </div>

      {/* Lock Overlay */}
      <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
        <div className="bg-black/60 px-3 py-1 rounded text-xs text-white font-medium">
          Upgrade to {tier}
        </div>
      </div>
    </div>
  );
}

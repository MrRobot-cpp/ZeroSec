"use client";

export default function RuleSectionCard({ title, icon, description, children }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-gray-600 transition-all">
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">{icon}</span>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        {description && (
          <p className="text-sm text-gray-400">{description}</p>
        )}
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

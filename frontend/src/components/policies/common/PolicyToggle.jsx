"use client";

export default function PolicyToggle({ enabled, onChange, label }) {
  return (
    <button
      onClick={onChange}
      className={`flex items-center gap-2 px-3 py-1.5 rounded border text-sm font-medium transition-colors ${
        enabled
          ? "bg-green-900/30 border-green-500/50 text-green-300"
          : "bg-gray-700 border-gray-600 text-gray-400"
      }`}
    >
      <div
        className={`w-4 h-4 rounded border transition-colors ${
          enabled ? "bg-green-600 border-green-500" : "bg-gray-600 border-gray-500"
        }`}
      />
      {label}
    </button>
  );
}

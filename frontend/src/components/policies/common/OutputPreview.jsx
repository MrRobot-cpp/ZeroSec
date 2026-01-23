"use client";

export default function OutputPreview({ output }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium text-gray-300 mb-2 block">Original Output</label>
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
          <p className="text-sm text-red-200 break-words">{output.original}</p>
        </div>
      </div>

      <div className="flex justify-center">
        <div className="px-3 py-1 bg-gray-700 rounded text-xs text-gray-400">↓ After Masking ↓</div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-300 mb-2 block">Masked Output</label>
        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
          <p className="text-sm text-green-200 break-words">{output.masked}</p>
        </div>
      </div>
    </div>
  );
}

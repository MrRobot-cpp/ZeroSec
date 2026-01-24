"use client";
import { useState } from "react";

export default function PolicyTable({ columns, data, title, onDelete }) {
  const [expandedRow, setExpandedRow] = useState(null);

  return (
    <div className="space-y-3">
      {title && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
        </div>
      )}

      <div className="overflow-x-auto border border-gray-700 rounded-lg bg-gray-900/50">
        <table className="w-full text-sm">
          <thead className="bg-gray-800/50 border-b border-gray-700">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className="px-4 py-2.5 text-left font-medium text-gray-300 text-xs uppercase tracking-wider"
                >
                  {col.label}
                </th>
              ))}
              <th className="px-4 py-2.5 text-right font-medium text-gray-300 text-xs uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {data.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-gray-800/30 transition-colors border-b border-gray-700"
              >
                {columns.map((col) => (
                  <td key={`${row.id}-${col.key}`} style={{ width: col.width }} className="px-4 py-3">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onDelete(row.id)}
                    className="text-red-400 hover:text-red-300 text-xs font-medium"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            No rules configured
          </div>
        )}
      </div>
    </div>
  );
}

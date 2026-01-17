export default function Sidebar() {
return (
    <aside className="w-64 bg-neutral-900 flex flex-col p-4">
    <h1 className="text-2xl font-bold mb-8">ZeroSec</h1>
    <nav className="space-y-4">
        <button className="flex items-center gap-3 p-2 rounded-md bg-gradient-to-r from-purple-500 to-indigo-500 w-full text-left">
        <span className="text-lg">🏠</span>
        <span>Dashboard</span>
        </button>
        <button className="flex items-center gap-3 p-2 rounded-md hover:bg-neutral-800 w-full text-left">
        <span className="text-lg">🛡️</span>
        <span>Data Security</span>
        </button>
        <button className="flex items-center gap-3 p-2 rounded-md hover:bg-neutral-800 w-full text-left">
        <span className="text-lg">📊</span>
        <span>Analytics</span>
        </button>
        <button className="flex items-center gap-3 p-2 rounded-md hover:bg-neutral-800 w-full text-left">
        <span className="text-lg">⚙️</span>
        <span>Settings</span>
        </button>
    </nav>
    </aside>
);
}
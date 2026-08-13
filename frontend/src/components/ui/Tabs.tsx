"use client";

interface TabsProps {
  tabs: { id: string; label: string; count?: number }[];
  activeTab: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="inline-flex h-10 rounded-md border border-gray-300 bg-white p-1 shadow-panel">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`inline-flex min-w-32 items-center justify-center gap-2 rounded px-3 text-sm font-medium transition ${
            activeTab === tab.id ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          {tab.label}
          {typeof tab.count === "number" ? (
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                activeTab === tab.id ? "bg-white/15 text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              {tab.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

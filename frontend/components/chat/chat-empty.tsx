"use client";

export function ChatEmpty({
  onSuggestion,
}: {
  onSuggestion?: (message: string) => void;
}) {
  const suggestions = [
    "What's my current balance?",
    "Show my recent transactions",
    "How much did I spend on food this month?",
    "What are my financial goals?",
  ];

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center max-w-md space-y-6">
        <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto border border-accent/20">
          <svg
            className="w-8 h-8 text-accent"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-primary">
            Welcome to BuyWise
          </h2>
          <p className="text-sm text-muted mt-1">
            Your AI-powered personal finance assistant. Ask me anything about
            your finances.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onSuggestion?.(s)}
              className="text-left text-sm px-4 py-2.5 rounded-lg border border-border bg-surface hover:bg-surface-hover hover:border-accent/30 transition-all duration-200 cursor-pointer text-secondary hover:text-primary"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

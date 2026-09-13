"use client";

export function ChatEmpty({
  onSuggestion,
}: {
  onSuggestion?: (message: string) => void;
}) {
  const suggestions = [
    "What's my current balance?",
    "Show my recent transactions",
    "How much did I spend on Food this month?",
    "How are my goals tracking?",
  ];

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center max-w-md space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#5EC5C1] to-[#6FA8DC] flex items-center justify-center mx-auto text-white text-2xl">
          ✦
        </div>
        <div>
          <h2 className="serif text-2xl text-primary">Welcome to BuyWise</h2>
          <p className="text-sm text-secondary mt-1">
            Your AI money assistant. Ask, log an expense, or plan a goal —
            in plain words.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onSuggestion?.(s)}
              className="text-left text-sm px-4 py-2.5 rounded-xl border border-border bg-surface hover:bg-surface-hover transition-colors cursor-pointer text-secondary hover:text-primary"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

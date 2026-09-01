export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    planning: "bg-[#fff3cd] text-[#7a5b00]",
    training: "bg-[#d6eaf4] text-[#1d5a73]",
    evaluating: "bg-[#d6eaf4] text-[#1d5a73]",
    ready: "bg-[#d8f3ee] text-[#1b6b61]",
    merged: "bg-surface-2 text-muted",
    running: "bg-[#d6eaf4] text-[#1d5a73]",
    completed: "bg-[#d8f3ee] text-[#1b6b61]",
    failed: "bg-[#fde8ea] text-[#9b1c28]",
    idle: "bg-surface-2 text-muted",
  };

  return (
    <span
      className={`inline-flex items-center h-5 px-1.5 rounded text-[11px] font-medium capitalize ${
        styles[status] ?? styles.idle
      }`}
    >
      {status}
    </span>
  );
}

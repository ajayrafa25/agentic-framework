export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    planning: "bg-[#fff8c5] text-[#9a6700] border-[#d4a72c66]",
    training: "bg-[#ddf4ff] text-[#0969da] border-[#54aeff66]",
    evaluating: "bg-[#ddf4ff] text-[#0969da] border-[#54aeff66]",
    ready: "bg-[#dafbe1] text-[#1a7f37] border-[#4ac26b66]",
    merged: "bg-[#f6f8fa] text-[#656d76] border-[#d0d7de]",
    running: "bg-[#ddf4ff] text-[#0969da] border-[#54aeff66]",
    completed: "bg-[#dafbe1] text-[#1a7f37] border-[#4ac26b66]",
    failed: "bg-[#ffebe9] text-[#cf222e] border-[#ff818266]",
    idle: "bg-[#f6f8fa] text-[#656d76] border-[#d0d7de]",
  };

  return (
    <span
      className={`inline-flex items-center h-5 px-1.5 rounded-full border text-[11px] font-medium capitalize ${
        styles[status] ?? styles.idle
      }`}
    >
      {status}
    </span>
  );
}

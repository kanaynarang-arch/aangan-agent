/** The call as a conversation: agent on the left, caller on the right. Lines without a speaker are shown as plain notes. */
export function Transcript({ text }: { text: string }) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <div className="convo" role="log" aria-label="Call transcript">
      {lines.map((l, i) => {
        const m = l.match(/^(Agent|Caller)\s*:\s*(.*)$/i);
        if (!m) return <div key={i} className="msg note">{l}</div>;
        const agent = /^agent$/i.test(m[1]);
        return (
          <div key={i} className={`msg ${agent ? "agent" : "caller"}`}>
            <small>{agent ? "Agent" : "Caller"}</small>
            {m[2]}
          </div>
        );
      })}
    </div>
  );
}

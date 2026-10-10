"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { callbackAction } from "@/app/actions";
import { Icon } from "@/components/Icon";

type Phase = "idle" | "confirm" | "starting" | "live" | "ended";

/**
 * "Have Vani call back". Browser mode talks to the agent through the microphone (no phone number, nobody is rung);
 * phone mode rings the lead for real, so it asks to confirm first. Always says what happened.
 */
export function CallbackPanel({ id, mode, blocked, phoneLabel }: { id: string; mode: "browser" | "phone"; blocked: string | null; phoneLabel: string | null }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const roomRef = useRef<import("livekit-client").Room | null>(null);
  const audioRef = useRef<HTMLDivElement>(null);
  const failed = useRef(false);
  const router = useRouter();

  useEffect(() => () => { roomRef.current?.disconnect(); }, []);

  // The transcript arrives from Vani a little after the call ends, so look again a few times.
  function refreshSoon() {
    for (const s of [8, 20, 40, 70]) setTimeout(() => router.refresh(), s * 1000);
  }

  async function start() {
    setPhase("starting");
    setMsg(null);
    failed.current = false;
    const r = await callbackAction(id);
    if (!r.ok) { setPhase("idle"); setMsg({ ok: false, text: r.message }); return; }
    if (r.mode === "phone") { setPhase("ended"); setMsg({ ok: true, text: r.message }); refreshSoon(); return; }
    try {
      const { Room, RoomEvent, Track } = await import("livekit-client");
      const room = new Room();
      roomRef.current = room;
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) audioRef.current?.appendChild(track.attach());
      });
      room.on(RoomEvent.Disconnected, () => { if (failed.current) return; setPhase("ended"); refreshSoon(); });
      await room.connect(r.session.url, r.session.token);
      await room.localParticipant.setMicrophoneEnabled(true);
      setPhase("live");
      setMsg({ ok: true, text: r.message });
    } catch {
      failed.current = true;
      roomRef.current?.disconnect();
      setPhase("idle");
      setMsg({ ok: false, text: "Could not use the microphone or join the call. Allow microphone access in your browser and try again." });
    }
  }

  function hangUp() { roomRef.current?.disconnect(); }

  if (blocked) return <p className="small muted" style={{ margin: 0 }}>{blocked}</p>;

  return (
    <div>
      <div className="btns" style={{ marginTop: 0 }}>
        {(phase === "idle" || phase === "ended") && (
          <button type="button" className="b accent" onClick={() => (mode === "phone" ? setPhase("confirm") : start())}>
            <Icon name="phone" />{mode === "phone" ? "Have Vani ring them" : "Talk to Vani as the caller"}
          </button>
        )}
        {phase === "confirm" && (
          <>
            <button type="button" className="b primary" onClick={start}><Icon name="phone" />Yes, ring {phoneLabel ?? "them"} now</button>
            <button type="button" className="b" onClick={() => setPhase("idle")}>Cancel</button>
          </>
        )}
        {phase === "starting" && <button type="button" className="b" disabled>Connecting…</button>}
        {phase === "live" && <button type="button" className="b primary" onClick={hangUp}><Icon name="phone" />End call</button>}
      </div>
      {phase === "confirm" && <p className="small muted">This is a real call. Vani will ring {phoneLabel ?? "this number"} and ask only what is still missing. It never quotes a price.</p>}
      {mode === "browser" && phase !== "live" && !msg && (
        <p className="small muted">Opens a call in your browser, with no phone number needed. Vani starts exactly as it would on the lead&apos;s phone, and you play the lead. Nobody is rung.</p>
      )}
      {phase === "live" && <p className="banner ok" role="status">{msg?.text} Speak as the caller. Press End call when you are done.</p>}
      {phase !== "live" && msg && <p className={`banner ${msg.ok ? "ok" : "err"}`} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
      {phase === "ended" && mode === "browser" && <p className="small muted">The call has ended. The conversation appears below in a minute or so.</p>}
      <div ref={audioRef} hidden />
    </div>
  );
}

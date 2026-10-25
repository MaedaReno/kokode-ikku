import { useState, type FormEvent } from "react";
import { verifyPasscode } from "../lib/api";
import { VerticalTitle } from "../components/VerticalTitle";

export function PasscodeGate({ onPass }: { onPass: (code: string) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = code.trim();
    if (!v) return;
    setChecking(true);
    setError(null);
    try {
      if (await verifyPasscode(v)) onPass(v);
      else setError("合言葉が違います。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "確認できませんでした。");
    } finally {
      setChecking(false);
    }
  };

  return (
    <main className="home">
      <VerticalTitle />
      <form className="gate" onSubmit={submit}>
        <p className="home-lead">合言葉を入れてください。</p>
        <input
          type="password"
          autoComplete="off"
          aria-label="合言葉"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button className="btn primary big" type="submit" disabled={checking || !code.trim()}>
          {checking ? "確かめています…" : "入る"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </main>
  );
}

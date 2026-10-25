import { useState } from "react";
import type { Settings } from "../lib/settings";
import { clearWorks } from "../lib/gallery";
import { PageHeader } from "./PageHeader";

export function SettingsScreen({ settings, onChange, mock }: { settings: Settings; onChange: (p: Partial<Settings>) => void; mock: boolean }) {
  const [seal, setSeal] = useState(settings.sealName);
  const [confirmClear, setConfirmClear] = useState(false);
  const [cleared, setCleared] = useState(false);

  return (
    <main className="screen">
      <div className="screen-body">
        <PageHeader title="設定" />

        <section className="field">
          <label htmlFor="seal" className="field-label">
            落款の名前<span className="sub">1〜4文字。俳号をどうぞ</span>
          </label>
          <input
            id="seal"
            value={seal}
            maxLength={4}
            placeholder="一句"
            onChange={(e) => setSeal(e.target.value)}
            onBlur={() => onChange({ sealName: seal.trim() || "一句" })}
          />
        </section>

        <section className="field">
          <h2>色調の初期値</h2>
          <div className="chips">
            {(
              [
                ["auto", "句の季節に合わせる"],
                ["original", "元のまま"],
              ] as const
            ).map(([v, label]) => (
              <button key={v} className={`chip ${settings.defaultTone === v ? "on" : ""}`} aria-pressed={settings.defaultTone === v} onClick={() => onChange({ defaultTone: v })}>
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="field">
          <label className="switch-row">
            <span>
              詠んだ句をギャラリーに残す
              <span className="sub block">この端末の中にだけ保存します</span>
            </span>
            <input type="checkbox" className="switch" checked={settings.autoGallery} onChange={(e) => onChange({ autoGallery: e.target.checked })} />
          </label>
        </section>

        <section className="field">
          <label className="switch-row">
            <span>
              音を鳴らす
              <span className="sub block">筆の擦れる音と、落款を押す音</span>
            </span>
            <input type="checkbox" className="switch" checked={settings.sound} onChange={(e) => onChange({ sound: e.target.checked })} />
          </label>
        </section>

        <section className="field">
          <h2>ギャラリー</h2>
          {cleared ? (
            <p className="hint">ギャラリーを空にしました。</p>
          ) : confirmClear ? (
            <div className="confirm-row">
              <button
                className="btn danger"
                onClick={async () => {
                  await clearWorks();
                  setCleared(true);
                  setConfirmClear(false);
                }}
              >
                すべて消す
              </button>
              <button className="btn" onClick={() => setConfirmClear(false)}>
                やめる
              </button>
            </div>
          ) : (
            <button className="btn" onClick={() => setConfirmClear(true)}>
              ギャラリーを空にする
            </button>
          )}
        </section>

        <p className="hint about">
          ここで一句　句は Claude が詠みます。{mock ? "いまは見本の句を返すモードです。" : ""}
        </p>
      </div>
    </main>
  );
}

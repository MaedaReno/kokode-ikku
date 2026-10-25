import { useState } from "react";
import { BASICS, SEASONS, type Example } from "../lib/zukan";
import { PageHeader } from "./PageHeader";

const TABS = ["基本", ...SEASONS.map((s) => s.season)];

function Examples({ items }: { items: Example[] }) {
  if (!items.length) return null;
  return (
    <ul className="examples">
      {items.map((e) => (
        <li key={e.verse}>
          <span className="example-verse">{e.verse}</span>
          <span className="example-author">{e.author}</span>
        </li>
      ))}
    </ul>
  );
}

export function ZukanScreen() {
  const [tab, setTab] = useState("基本");
  const season = SEASONS.find((s) => s.season === tab);

  return (
    <main className="screen">
      <div className="screen-body">
        <PageHeader title="俳句図鑑" sub="型と季語を、名句とともに" />
        <div className="segment sticky-tabs" role="tablist" aria-label="図鑑の分類">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>

        {tab === "基本" && (
          <div className="zukan-list">
            {BASICS.map((b) => (
              <section key={b.title} className="zukan-card">
                <h2>{b.title}</h2>
                <p>{b.body}</p>
                <Examples items={b.examples} />
              </section>
            ))}
          </div>
        )}

        {season && (
          <div className="zukan-list">
            {season.items.map((k) => (
              <section key={k.word} className="zukan-card">
                <h2>
                  {k.word}
                  <span className="sub">{k.reading}</span>
                </h2>
                <p>{k.meaning}</p>
                <Examples items={k.examples} />
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

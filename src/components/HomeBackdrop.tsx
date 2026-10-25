import { useEffect, useState } from "react";
import { listWorks } from "../lib/gallery";
import { SAMPLE_POSTS, type Post } from "../lib/feed";
import { SceneArt } from "./SceneArt";

type Tile = { key: string; image?: string; post?: Post };

const COLUMNS = 3;
const MAX_WORKS = 9;

/** ホームの背景に、自分の作品とみんなの句をゆっくり流す */
export function HomeBackdrop() {
  const [tiles, setTiles] = useState<Tile[]>(() => SAMPLE_POSTS.map((p) => ({ key: p.id, post: p })));

  useEffect(() => {
    let urls: string[] = [];
    let alive = true;
    listWorks().then((works) => {
      if (!alive) return;
      urls = works.slice(0, MAX_WORKS).map((w) => URL.createObjectURL(w.image));
      const mine: Tile[] = urls.map((u, i) => ({ key: `w${i}`, image: u }));
      const samples: Tile[] = SAMPLE_POSTS.map((p) => ({ key: p.id, post: p }));
      // 自分の作品と見本を交互に並べる
      const mixed: Tile[] = [];
      for (let i = 0; i < Math.max(mine.length, samples.length); i++) {
        if (mine[i]) mixed.push(mine[i]);
        if (samples[i]) mixed.push(samples[i]);
      }
      setTiles(mixed);
    });
    return () => {
      alive = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const columns = Array.from({ length: COLUMNS }, (_, c) => tiles.filter((_, i) => i % COLUMNS === c));
  // 列ごとに並びをずらし、同じ絵が横に揃わないようにする
  columns.forEach((col, c) => col.push(...col.splice(0, c % Math.max(1, col.length))));

  return (
    <div className="backdrop" aria-hidden="true">
      {columns.map((col, c) => (
        <div key={c} className={`backdrop-col ${c % 2 ? "down" : "up"}`} style={{ animationDuration: `${70 + c * 14}s` }}>
          {/* 継ぎ目なく流すため、同じ並びを2回置く */}
          {[0, 1].map((copy) =>
            col.map((t) => (
              <div key={`${copy}-${t.key}`} className="backdrop-tile">
                {t.image ? (
                  <img src={t.image} alt="" />
                ) : (
                  t.post && (
                    <>
                      <SceneArt scene={t.post.scene} />
                      <p className="backdrop-verse">
                        {t.post.lines.map((l, i) => (
                          <span key={i} style={{ marginTop: `${i * 0.9}em` }}>
                            {l}
                          </span>
                        ))}
                      </p>
                    </>
                  )
                )}
              </div>
            )),
          )}
        </div>
      ))}
    </div>
  );
}

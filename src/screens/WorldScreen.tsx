import { SAMPLE_POSTS } from "../lib/feed";
import { SceneArt } from "../components/SceneArt";
import { HeartIcon } from "../components/Icons";
import { PageHeader } from "./PageHeader";

export function WorldScreen() {
  return (
    <main className="screen">
      <div className="screen-body">
        <PageHeader title="世界の俳句" sub="このアプリで詠まれた句と写真" />
        <p className="notice">いまは見本の投稿を表示しています。投稿の機能は準備中です。</p>
        <ul className="feed">
          {SAMPLE_POSTS.map((p) => (
            <li key={p.id} className="post">
              <div className="post-art">
                <SceneArt scene={p.scene} />
                <p className="post-verse">
                  {p.lines.map((l, i) => (
                    <span key={i} style={{ marginTop: `${i * 0.9}em` }}>
                      {l}
                    </span>
                  ))}
                </p>
              </div>
              <div className="post-meta">
                <span className="avatar" aria-hidden="true">
                  {p.author[0]}
                </span>
                <span className="post-author">
                  {p.author}
                  <span className="sub">{p.ago}</span>
                </span>
                <span className="likes" aria-label={`${p.likes}件のいいね`}>
                  <HeartIcon />
                  {p.likes}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

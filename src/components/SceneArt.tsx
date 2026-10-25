import type { Scene } from "../lib/feed";

/** 見本投稿のための、写真の代わりの絵 */
export function SceneArt({ scene }: { scene: Scene }) {
  return (
    <div className={`scene scene-${scene}`} aria-hidden="true">
      {scene === "city" && (
        <>
          <span className="sun" />
          <span className="bld" style={{ left: "4%", height: "38%", width: "18%" }} />
          <span className="bld" style={{ left: "26%", height: "52%", width: "16%" }} />
          <span className="bld" style={{ left: "46%", height: "30%", width: "20%" }} />
          <span className="bld" style={{ left: "70%", height: "46%", width: "24%" }} />
        </>
      )}
      {scene === "rain" && (
        <>
          {Array.from({ length: 26 }, (_, i) => (
            <span key={i} className="drop" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 90}%` }} />
          ))}
          <span className="bld puddle" style={{ left: "0", height: "12%", width: "100%" }} />
        </>
      )}
      {scene === "night" && (
        <>
          <span className="bld" style={{ left: "8%", height: "34%", width: "56%" }} />
          <span className="lit" style={{ left: "14%", bottom: "8%", width: "44%", height: "14%" }} />
          <span className="moon" />
        </>
      )}
      {scene === "station" && (
        <>
          <span className="bld" style={{ left: "0", height: "18%", width: "100%" }} />
          <span className="pole" style={{ left: "30%" }} />
          <span className="clock" />
        </>
      )}
      {scene === "room" && (
        <>
          <span className="window" />
          <span className="bld" style={{ left: "0", height: "16%", width: "100%" }} />
        </>
      )}
      {scene === "riverside" && (
        <>
          <span className="hill" />
          <span className="river" />
        </>
      )}
    </div>
  );
}

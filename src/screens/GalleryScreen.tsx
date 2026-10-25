import { useEffect, useMemo, useState } from "react";
import { deleteWork, listWorks, type Work } from "../lib/gallery";
import { saveBlob } from "../lib/share";
import { Sheet } from "../components/Sheet";
import { SaveIcon, TrashIcon } from "../components/Icons";
import { PageHeader } from "./PageHeader";

export function GalleryScreen({ onStart }: { onStart: () => void }) {
  const [works, setWorks] = useState<Work[] | null>(null);
  const [open, setOpen] = useState<Work | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    listWorks().then(setWorks);
  }, []);

  const urls = useMemo(() => new Map((works ?? []).map((w) => [w.id, URL.createObjectURL(w.image)])), [works]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  return (
    <main className="screen">
      <div className="screen-body">
        <PageHeader title="ギャラリー" sub={works?.length ? `${works.length}句` : undefined} />
        {works && works.length === 0 && (
          <div className="empty">
            <p>まだ作品がありません。</p>
            <button className="btn primary" onClick={onStart}>
              一句詠みにいく
            </button>
          </div>
        )}
        <ul className="gallery-grid">
          {(works ?? []).map((w) => (
            <li key={w.id}>
              <button
                className="gallery-item"
                onClick={() => {
                  setOpen(w);
                  setConfirmDelete(false);
                }}
                aria-label={w.lines.join(" ")}
              >
                <img src={urls.get(w.id)} alt="" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {open && (
        <Sheet title={new Date(open.createdAt).toLocaleDateString("ja-JP", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })} onClose={() => setOpen(null)}>
          <img className="gallery-detail" src={urls.get(open.id)} alt={open.lines.join(" ")} />
          <p className="haiku-text">{open.lines.join("　")}</p>
          {open.note && <p className="haiku-note">{open.note}</p>}
          <div className="confirm-row">
            <button className="btn primary" onClick={() => saveBlob(open.image, `kokode-ikku-${open.createdAt}.jpg`)}>
              <SaveIcon size={20} />
              保存・共有
            </button>
            {confirmDelete ? (
              <button
                className="btn danger"
                onClick={async () => {
                  await deleteWork(open.id);
                  setWorks((ws) => (ws ?? []).filter((w) => w.id !== open.id));
                  setOpen(null);
                }}
              >
                本当に消す
              </button>
            ) : (
              <button className="btn" onClick={() => setConfirmDelete(true)}>
                <TrashIcon />
                消す
              </button>
            )}
          </div>
        </Sheet>
      )}
    </main>
  );
}

import { BookIcon, GalleryIcon, GlobeIcon, HomeIcon, SettingsIcon } from "./Icons";

export type Tab = "gallery" | "world" | "home" | "zukan" | "settings";

const ITEMS: { tab: Tab; label: string; icon: JSX.Element }[] = [
  { tab: "gallery", label: "ギャラリー", icon: <GalleryIcon /> },
  { tab: "world", label: "世界の俳句", icon: <GlobeIcon /> },
  { tab: "home", label: "ホーム", icon: <HomeIcon /> },
  { tab: "zukan", label: "図鑑", icon: <BookIcon /> },
  { tab: "settings", label: "設定", icon: <SettingsIcon /> },
];

export function TabBar({ current, onSelect }: { current: Tab; onSelect: (t: Tab) => void }) {
  return (
    <nav className="tabbar" aria-label="メニュー">
      {ITEMS.map((it) => (
        <button
          key={it.tab}
          className={`${it.tab === "home" ? "tab-home" : ""} ${current === it.tab ? "on" : ""}`}
          aria-current={current === it.tab ? "page" : undefined}
          onClick={() => onSelect(it.tab)}
        >
          <span className="tab-icon">{it.icon}</span>
          <span className="tab-label">{it.label}</span>
        </button>
      ))}
    </nav>
  );
}

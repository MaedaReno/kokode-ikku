import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/yuji-syuku/400.css";
import "@fontsource/yuji-boku/400.css";
import "@fontsource/yuji-mai/400.css";
import "@fontsource/potta-one/400.css";
import "@fontsource/dela-gothic-one/400.css";
import "@fontsource/kaisei-tokumin/800.css";
import "@fontsource/shippori-mincho/400.css";
import "@fontsource/shippori-mincho/700.css";
import "./styles.css";
import App from "./App";
import { installInkRipple } from "./lib/motion";
import { installSoundUnlock } from "./lib/sound";

installInkRipple();
installSoundUnlock();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

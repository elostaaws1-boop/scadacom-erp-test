"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && window.location.protocol !== "http:") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    if ("serviceWorker" in navigator && window.location.hostname === "localhost") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  return null;
}

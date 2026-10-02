async () => {
  // Collect reel IDs from a Facebook reels tab by auto-scrolling.
  // Call repeatedly (state is kept on window) until result.done is true.
  // Each call scrolls for at most ~20s so it fits the browser tool timeout.
  const MAX = 200;
  const BUDGET_MS = 20000;
  const IDLE_LIMIT = 4;
  const s = window.__gcReels || (window.__gcReels = { ids: [], seen: new Set(), idle: 0, calls: 0 });
  s.calls += 1;

  const loginWall = !!document.querySelector('form[action*="login"] input[name="email"], #login_form');
  if (loginWall && s.ids.length === 0) {
    return JSON.stringify({ ok: false, login_required: true, error: "Facebook shows a login form - cookies not applied or expired" });
  }

  const grab = () => {
    for (const a of document.querySelectorAll('a[href*="/reel/"]')) {
      const m = a.href.match(/\/reel\/(\d{8,20})/);
      if (m && !s.seen.has(m[1])) {
        s.seen.add(m[1]);
        s.ids.push(m[1]);
      }
    }
  };

  const t0 = Date.now();
  grab();
  while (Date.now() - t0 < BUDGET_MS && s.ids.length < MAX && s.idle < IDLE_LIMIT) {
    const before = s.ids.length;
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000));
    grab();
    s.idle = s.ids.length === before ? s.idle + 1 : 0;
  }

  const done = s.ids.length >= MAX || s.idle >= IDLE_LIMIT;
  return JSON.stringify({ ok: true, count: s.ids.length, done, calls: s.calls, ids: done ? s.ids.join(",") : undefined });
}

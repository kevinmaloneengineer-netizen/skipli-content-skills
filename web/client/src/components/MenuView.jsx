/**
 * A restaurant menu drawn from { name, tagline, note, contact, theme, color, logo, sections: [{ title, items: [{ name, price, desc, tag }] }] }.
 * mode "print": an A4 sheet in two columns (printed or saved as PDF); mode "web": the phone page guests open from the QR.
 * The words are the shop's own, so they are never run through the interface translation (translate="no").
 */
export default function MenuView({ menu, mode = "web" }) {
  const { name, tagline, note, contact, theme = "cream", color = "#c2451f", logo, sections = [] } = menu ?? {};
  return (
    <article className={`menu-view is-${mode} theme-${theme}`} style={{ "--menu-accent": color }} translate="no">
      <header className="menu-head">
        {logo && <img className="menu-logo" src={logo} alt="" />}
        <h1>{name || "Tên quán"}</h1>
        {tagline && <p className="menu-tagline">{tagline}</p>}
        <span className="menu-rule" aria-hidden="true" />
      </header>
      {mode === "web" && sections.length > 1 && (
        <nav className="menu-tabs" aria-label="Nhóm món">
          {sections.map((s, i) => (
            <a key={i} href={`#menu-sec-${i}`}>{s.title || `Nhóm ${i + 1}`}</a>
          ))}
        </nav>
      )}
      <div className="menu-body">
        {sections.map((s, i) => (
          <section key={i} id={mode === "web" ? `menu-sec-${i}` : undefined} className="menu-sec">
            {s.title && <h2>{s.title}</h2>}
            <ul>
              {s.items.map((it, k) => (
                <li key={k} className="menu-item">
                  <div className="menu-line">
                    <b>{it.name}</b>
                    {it.tag && <em className="menu-tag">{it.tag}</em>}
                    <span className="menu-dots" aria-hidden="true" />
                    {it.price && <span className="menu-price">{it.price}</span>}
                  </div>
                  {it.desc && <p>{it.desc}</p>}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {(note || contact) && (
        <footer className="menu-foot">
          {note && <p>{note}</p>}
          {contact && <p className="menu-contact">{contact}</p>}
        </footer>
      )}
    </article>
  );
}

/**
 * The menu as typed in the form: "# Nhóm" starts a group; every other line is "Tên món - giá - mô tả".
 * A line ending in " *" is marked as a pick ("Nên thử"). Dishes before any group go in a group with no title.
 */
export function parseMenu(text, pickLabel = "Nên thử") {
  const sections = [];
  let cur = null;
  for (const raw of String(text ?? "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      cur = { title: line.replace(/^#+\s*/, "").slice(0, 60), items: [] };
      sections.push(cur);
      continue;
    }
    if (!cur) {
      cur = { title: "", items: [] };
      sections.push(cur);
    }
    const pick = /\s\*$/.test(line);
    const parts = line.replace(/\s\*$/, "").split(/\s+[-–|]\s+/).map((x) => x.trim());
    const [name, ...rest] = parts;
    // The price is the part that looks like money; the rest is the description.
    const pi = rest.findIndex((x) => /^(\$\s?)?\d[\d.,]*\s?(k|đ|vnd|usd|\$)?$/i.test(x));
    const price = pi >= 0 ? rest[pi] : "";
    const desc = rest.filter((_, k) => k !== pi).join(" - ");
    cur.items.push({ name: name.slice(0, 80), price: price.slice(0, 24), desc: desc.slice(0, 200), tag: pick ? pickLabel : "" });
  }
  return sections.filter((s) => s.items.length);
}

/** The form text back from a saved menu (for editing it again). */
export function menuText(sections = []) {
  return sections
    .map((s) => [s.title ? `# ${s.title}` : "", ...s.items.map((it) => [it.name, it.price, it.desc].filter(Boolean).join(" - ") + (it.tag ? " *" : ""))].filter(Boolean).join("\n"))
    .join("\n\n");
}

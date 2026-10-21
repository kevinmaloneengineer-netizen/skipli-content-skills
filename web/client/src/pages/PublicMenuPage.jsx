import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import MenuView from "../components/MenuView.jsx";

/** /m/:id: the online menu guests open from the table QR. No login, no app chrome, just the menu. */
export default function PublicMenuPage() {
  const { id } = useParams();
  const [menu, setMenu] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/public/menus/${encodeURIComponent(id)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "Không mở được menu");
        setMenu(data.menu);
        document.title = data.menu.name ? `${data.menu.name} · Menu` : "Menu";
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <main className="public-menu is-empty"><p>{error}</p></main>;
  if (!menu) return <main className="public-menu is-empty"><span className="spinner" aria-label="Đang tải" /></main>;
  return (
    <main className={`public-menu theme-${menu.theme}`}>
      <MenuView menu={menu} mode="web" />
    </main>
  );
}

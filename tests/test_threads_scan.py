"""Offline tests for skills/threads-viral-finder/scripts/threads_scan.py (python3 -m unittest discover tests)."""
import importlib.util
import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("threads_scan", ROOT / "skills/threads-viral-finder/scripts/threads_scan.py")
ts = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ts)


def post(code, likes, replies=0, reposts=0, quotes=0, is_reply=False, user="alice", text="hello", taken=1790000000):
    return {
        "code": code, "pk": "1", "like_count": likes, "taken_at": taken, "media_type": 19,
        "caption": {"text": text}, "user": {"username": user, "is_verified": False},
        "text_post_app_info": {"direct_reply_count": replies, "repost_count": reposts, "quote_count": quotes, "is_reply": is_reply},
    }


def page(*posts):
    data = {"require": [["x", {"edges": [{"node": {"thread_items": [{"post": p} for p in posts]}}]}]]}
    return (
        '<html><script type="application/json" data-sjs>{"unrelated": 1}</script>'
        f'<script type="application/json" data-sjs>{json.dumps(data)}</script>'
        '<script type="application/json">not json text_post_app_info</script></html>'
    )


class ThreadsScanTest(unittest.TestCase):
    def test_extract_dedupes_by_code(self):
        html = page(post("A", 5), post("B", 1), post("A", 5))
        self.assertEqual(sorted(p["code"] for p in ts.extract_posts(html)), ["A", "B"])

    def test_to_post_engagement_and_url(self):
        p = ts.to_post(post("A", 10, replies=2, reposts=1, quotes=1, user="bob"), "search:x")
        self.assertEqual(p["engagement"], 10 + 2 * 2 + 3 * 2)
        self.assertEqual(p["url"], "https://www.threads.com/@bob/post/A")
        self.assertEqual(p["media"], "text")
        self.assertEqual(p["created"], "2026-09-21")

    def test_profile_url_normalisation(self):
        self.assertEqual(ts.profile_url("@zuck"), "https://www.threads.com/@zuck")
        self.assertEqual(ts.profile_url("https://www.threads.net/@a.b_c/post/x"), "https://www.threads.com/@a.b_c")
        with self.assertRaises(ValueError):
            ts.profile_url("bad user!")

    def test_search_url(self):
        self.assertIn("q=b%C3%A1n+h%C3%A0ng", ts.search_url("bán hàng"))
        self.assertIn("filter=recent", ts.search_url("x", recent=True))


if __name__ == "__main__":
    unittest.main()

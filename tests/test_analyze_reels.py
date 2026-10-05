"""analyze_reels.py: statistics from list_reels.py output (no network)."""
import json
import subprocess
import sys
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "skills/fanpage-analyzer/scripts/analyze_reels.py"
TUE_20H_VN = 1789477200  # 2026-09-15 20:00 +07:00 (Tuesday)
DAY = 86400


def reel(i, ts, dur, reactions, comments=0, shares=0, caption=""):
    return {"id": str(i), "url": f"https://www.facebook.com/reel/{i}/", "created_ts": ts, "duration": dur,
            "reactions": reactions, "comments": comments, "shares": shares, "caption": caption, "plays_text": "1K"}


def analyze(data):
    p = subprocess.run([sys.executable, str(SCRIPT)], input=json.dumps(data), capture_output=True, text=True, check=True)
    return json.loads(p.stdout)


class AnalyzeTest(unittest.TestCase):
    def test_numbers(self):
        reels = [reel(1, TUE_20H_VN, 20, 1000, 100, 10, "Comment SEO #seo #1"),  # eng 1230
                 reel(2, TUE_20H_VN + 7 * DAY, 25, 100, caption="#SEO"),        # eng 100
                 reel(3, TUE_20H_VN + 1 * DAY, 90, 10),                         # Wed, eng 10
                 reel(4, TUE_20H_VN + 14 * DAY - 10 * 3600, 40, 50)]            # Tue 10:00, eng 50
        out = analyze({"ok": True, "profile": "x", "reels": reels})
        self.assertTrue(out["ok"])
        self.assertEqual(out["reels_analyzed"], 4)
        self.assertEqual(out["engagement"]["median"], 75)
        self.assertEqual(out["viral"]["count"], 1)
        self.assertEqual(out["period"]["days"], 13)
        tue = next(g for g in out["by_weekday"] if g["group"] == "Thứ 3")
        self.assertEqual(tue["reels"], 3)
        self.assertEqual({g["group"] for g in out["by_time_of_day"]}, {"tối (18h đến 23h)", "sáng (5h đến 11h)"})
        self.assertEqual(out["by_duration"][0]["group"], "15 đến 30 giây")
        self.assertEqual(out["top_hashtags"], [{"tag": "#seo", "reels": 2}], "case-folded, '#1' is not a hashtag")
        self.assertEqual(out["top"][0]["posted"], "2026-09-15 20:00")
        self.assertEqual(out["top"][0]["x_median"], 16.4)

    def test_failures_pass_through(self):
        self.assertEqual(analyze({"ok": False, "error": "blocked"}), {"ok": False, "error": "blocked"})
        self.assertFalse(analyze({"ok": True, "reels": [{"id": "1"}]})["ok"])


if __name__ == "__main__":
    unittest.main()

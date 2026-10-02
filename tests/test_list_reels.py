"""Offline tests for skills/fb-reel-reader/scripts/list_reels.py (python3 -m unittest discover tests)."""
import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("list_reels", ROOT / "skills/fb-reel-reader/scripts/list_reels.py")
lr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lr)


def block(video_id, reactions, comments, shares):
    # Same shape as a real reel page: comments/shares, filler, reactors, then tracking with the video id.
    return (
        f'"total_comment_count":{comments},"share_count_reduced":"{shares}"' + "x" * 500
        + f'"likers":{{"count":{reactions}}},"unified_reactors":{{"count":{reactions}}}'
        + f',"post_id":"99","tracking":"{{\\"top_level_post_id\\":\\"{video_id}\\",\\"video_id\\":\\"{video_id}\\"}}"' + "y" * 300
    )


class OwnStatsTest(unittest.TestCase):
    def test_picks_the_block_of_the_requested_reel_not_the_first(self):
        html = block("111", 4149, 210, "198") + block("222", 1613, 43, "81") + block("333", 338, 4, "20")
        self.assertEqual(lr._own_stats(html, "333"), (338, 4, 20))
        self.assertEqual(lr._own_stats(html, "111"), (4149, 210, 198))

    def test_unknown_reel_returns_none_instead_of_someone_elses_numbers(self):
        html = block("111", 4149, 210, "198")
        self.assertEqual(lr._own_stats(html, "999"), (None, None, None))

    def test_parse_count(self):
        self.assertEqual(lr.parse_count("1.2K"), 1200)
        self.assertEqual(lr.parse_count("506"), 506)


def _edge(i):
    return {"profile_reel_node": {"node": {"message": {"text": f"cap {i}"}, "creation_time": 1790000000,
                                           "short_form_video_context": {"playback_video": {"id": str(10_000_000_000 + i)}}}}}


PAGE_HTML = (
    '"LSD",[],{"token":"tok"}' + '"id":"YXBwX2NvbGxlY3Rpb246ZmFy"' + "z" * 200 + '"id":"YXBwX2NvbGxlY3Rpb246bmVhcg=="'
    + '"aggregated_fb_shorts":{"edges":[],"page_info":{"has_next_page":true,"end_cursor":"C0"}}'
)


class PaginateTest(unittest.TestCase):
    def setUp(self):
        self._orig = (lr._graphql_page, lr._discover_query, lr.time.sleep)
        lr.time.sleep = lambda s: None

    def tearDown(self):
        lr._graphql_page, lr._discover_query, lr.time.sleep = self._orig

    def test_cursor_and_nearest_collection_first(self):
        self.assertEqual(lr._first_cursor(PAGE_HTML), "C0")
        self.assertEqual(lr._collection_candidates(PAGE_HTML)[0], "YXBwX2NvbGxlY3Rpb246bmVhcg==")

    def test_pages_until_count_and_skips_duplicates(self):
        calls = []

        def fake(lsd, coll, cursor, referer, doc_id, pvs):
            calls.append(cursor)
            n = len(calls)
            page = [lr.to_reel(_edge(k)) for k in range(n * 10 - 10, n * 10)]
            return page, f"C{n}"

        lr._graphql_page = fake
        first = [lr.to_reel(_edge(k)) for k in range(0, 10)]
        reels, note = lr.paginate("https://www.facebook.com/x/reels/", PAGE_HTML, first, 35)
        self.assertEqual(len(reels), 35)
        self.assertEqual(len({r["id"] for r in reels}), 35)
        self.assertIn("paged logged-out", note)

    def test_rediscovers_doc_id_once_then_gives_up_gracefully(self):
        seen_docs = []

        def broken(lsd, coll, cursor, referer, doc_id, pvs):
            seen_docs.append(doc_id)
            raise ValueError("missing_required_variable_value")

        lr._graphql_page = broken
        lr._discover_query = lambda html: ("NEWDOC", ["X"])
        first = [lr.to_reel(_edge(k)) for k in range(0, 10)]
        reels, note = lr.paginate("https://www.facebook.com/x/reels/", PAGE_HTML, first, 100)
        self.assertEqual(len(reels), 10, "keeps what it had instead of failing")
        self.assertIn("NEWDOC", seen_docs, "retried with the rediscovered doc_id")
        self.assertIn("stopped", note)


if __name__ == "__main__":
    unittest.main()

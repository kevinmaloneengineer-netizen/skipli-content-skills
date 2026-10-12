import re
import json, sys
src = json.load(open(sys.argv[1])); tr = json.load(open(sys.argv[2])); out = sys.argv[3]
OVERRIDES = {
 "Công cụ": "Tools", "Hoàn tất": "Done", "Đang chạy": "Running", "Đang chờ": "Queued", "Chờ duyệt ảnh": "Review photos",
 "tương tác trung vị": "median engagement", "Tương tác trung vị": "Median engagement", "Làm cho nhà bán hàng Việt": "Made for restaurants and small sellers",
 "Lịch sử": "History", "Thư viện": "Library", "Tạo content": "Create content", "Tìm nhanh": "Quick search",
 "Khách khen gì": "What customers praise", "Khách chê gì": "What customers complain about", "Đã kết nối": "Connected",
 "Lần chạy gần đây": "Recent runs", "Thao tác": "Actions", "Bước tiếp theo": "Next steps", "Thông tin đã nhập": "Your input",
 "lần chạy": "runs", "lượt nhắc": "mentions", "vừa xong": "just now", "trong 7 ngày": "in the last 7 days", "thành công": "success", "phút AI làm việc": "minutes of AI work", "Tạo": "Created", "Chạy trong": "Took", "Điểm": "Rating on", "Bình thường": "Neutral", "Hài lòng": "Satisfied", "Chưa hài lòng": "Unhappy",
 "Sao chép": "Copy", "Lưu": "Save", "Chạy lại": "Run again", "Xoá": "Delete", "Tải PDF": "Download PDF", "Dựng video →": "Build video →",
}
def fix(en):
    en = re.sub(r"(\d)\s*[–—]\s*(\d)", r"\1 to \2", en)  # "2–4" -> "2 to 4"
    return re.sub(r"\s*[–—]\s*", ", ", en)  # no dashes joining ideas
exact = {k: fix(OVERRIDES.get(k, tr[k])) for k in src["exact"] if k in tr and tr[k].strip() and tr[k] != k}
for k, v in OVERRIDES.items(): exact[k] = v
pats = [[k, fix(tr[k])] for k in src["patterns"] if k in tr and tr[k].strip()]
# A pattern's English must keep every ${...} of the Vietnamese.
import re
ok = []
for vi, en in pats:
    toks = re.findall(r"\$\{[^}]*\}", vi)
    if all(t in en for t in toks): ok.append([vi, en])
with open(out, "w") as f:
    f.write("// Generated from the Vietnamese strings in client/src (scratchpad extract + Groq translation). See lib/i18n.js.\n")
    f.write("// Edit by hand to fix a translation; regenerate to pick up new strings.\n")
    f.write("export const EN = " + json.dumps(exact, ensure_ascii=False, indent=0) + ";\n")
    f.write("export const EN_PATTERNS = " + json.dumps(ok, ensure_ascii=False, indent=0) + ";\n")
print(len(exact), "exact,", len(ok), "/", len(pats), "patterns")

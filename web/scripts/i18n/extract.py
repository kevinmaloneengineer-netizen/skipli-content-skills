import re, json, sys, pathlib
VI = re.compile(r"[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬĐÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴ]")
roots = [pathlib.Path(a) for a in sys.argv[1:]]  # e.g. client/src shared
exact, patterns = set(), set()
for f in [f for root in roots for f in list(root.rglob("*.jsx")) + list(root.rglob("*.js"))]:
    if "i18n" in str(f): continue
    src = f.read_text()
    src = re.sub(r"^\s*//.*$", "", src, flags=re.M)          # line comments
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)           # block comments
    # string literals
    for m in re.finditer(r'"((?:[^"\\\n]|\\.)*)"|\'((?:[^\'\\\n]|\\.)*)\'', src):
        t = (m.group(1) if m.group(1) is not None else m.group(2))
        if VI.search(t): exact.add(t.replace('\\"','"').replace("\\'","'").replace("\\n","\n"))
    # template literals
    for m in re.finditer(r"`((?:[^`\\]|\\.)*)`", src, flags=re.S):
        t = m.group(1)
        if not VI.search(t): continue
        if "${" in t: patterns.add(t)
        else: exact.add(t)
    # JSX text between tags
    for m in re.finditer(r">([^<>{}]+)<", src):
        t = " ".join(m.group(1).split())
        if t and VI.search(t): exact.add(t)
    # JSX text next to expressions: split on {...}
    for m in re.finditer(r">([^<>]*\{[^<>]*)<", src):
        for piece in re.split(r"\{[^{}]*\}", m.group(1)):
            t = " ".join(piece.split())
            if t and VI.search(t): exact.add(t)
exact = sorted(x.strip() for x in exact if x.strip())
print(json.dumps({"exact": exact, "patterns": sorted(patterns)}, ensure_ascii=False, indent=0))

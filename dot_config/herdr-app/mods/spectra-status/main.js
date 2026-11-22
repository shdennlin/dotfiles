// Spectra (OpenSpec) progress in the bottom bar: change name, tasks done/total, time since tasks.md changed.
//
// Which changes: the ones the focused terminal's Claude session touched (Edit/Write/Read paths under
// openspec/changes/<name>/ in its transcript), at most 2. The session is found exactly: `hc read` the focused
// terminal and take the 8-char session id the status line prints after the version ("v2.1.319 827eee70"), then
// open ~/.claude/projects/*/<id>*.jsonl. A Claude terminal without a readable id falls back to guessing from its
// cwd (newest transcript written in the last 24h in cwd or a parent), and is marked "~" because it is a guess.
// Nothing is ever shown that this terminal cannot be tied to: a terminal that is not Claude, or has no transcript,
// says "no session"; a session that touched no change says so. There is no "recently updated" filler.
// Where: the nearest ancestor of the pane's cwd that has openspec/changes, plus its .worktrees copies
// (<root>/.worktrees/*/ and <root>/*/.worktrees/*/). The same change in several places shows its newest tasks.md.
// Read-only: only `exec` of sh/grep/stat/ls; nothing is written.

import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme, home, exec, hc, focused } from "herdr";

const TICK_MS = 1_000;
const RESCAN_MS = 10_000;
const MAX_ITEMS = 2;
const TOUCH_MAX_AGE_MS = 24 * 3600_000;

// --- pure logic (tested outside Herdr by extracting this block; keep it free of imports) ---
// Claude Code names a project dir after the cwd with every non-alphanumeric (except '-') turned into '-'.
const encodeProjectDir = (cwd) => String(cwd).replace(/[^A-Za-z0-9-]/g, "-");
// cwd and every parent up to (not including) "/" , nearest first.
function ancestors(cwd) {
  const out = [];
  let p = String(cwd || "").replace(/\/+$/, "");
  while (p && p !== "/") { out.push(p); p = p.slice(0, p.lastIndexOf("/")); }
  return out;
}
// A cwd inside <root>/.worktrees/<name>/... belongs to <root>; otherwise null (the shell finds the root).
function worktreeParent(cwd) {
  const i = String(cwd).indexOf("/.worktrees/");
  return i > 0 ? String(cwd).slice(0, i) : null;
}
// The session id Claude Code's status line prints after its version, from `hc read` output. Only the last
// lines are looked at (the status line is at the bottom) and the id must follow a version number, so a stray
// 8-hex word in the conversation is not taken. Last match wins. null when absent.
function extractSessionId(screen) {
  const tail = String(screen ?? "").split("\n").slice(-14).join("\n");
  let id = null;
  for (const m of tail.matchAll(/\bv\d+\.\d+\.\d+\s+([0-9a-f]{8})\b/g)) id = m[1];
  return id;
}
// Find one terminal in `hc ls` JSON: { agent, cwd } or null.
function parseHcLs(text, terminal) {
  try {
    const t = JSON.parse(text).terminals?.find((x) => x.address === terminal);
    return t ? { agent: t.agent ?? null, cwd: t.cwd ?? null } : null;
  } catch { return null; }
}
const isClaude = (info) => info?.agent === "claude-code";
// Lines "mtime<TAB>done<TAB>total<TAB>path" -> entries; malformed lines are skipped.
function parseScan(text) {
  const out = [];
  for (const line of String(text ?? "").split("\n")) {
    const m = line.match(/^(\d+)\t(\d+)\t(\d+)\t(.+\/openspec\/changes\/([^/]+)\/tasks\.md)$/);
    if (!m) continue;
    out.push({ name: m[5], path: m[4], mtime: Number(m[1]) * 1000, done: Number(m[2]), total: Number(m[2]) + Number(m[3]) });
  }
  return out;
}
// One entry per change name: the copy whose tasks.md changed last. (`done` + `open` were given as the 2nd/3rd field.)
function newestPerName(entries) {
  const by = new Map();
  for (const e of entries) {
    const cur = by.get(e.name);
    if (!cur || e.mtime > cur.mtime) by.set(e.name, e);
  }
  return [...by.values()];
}
// Output of the touched-script: "KEY <path> <mtime> <size>", then "SAME" or grep -o lines.
// Returns { key, mtime, names } (names in order of LAST touch, oldest first) or { none:true } / { same:true, key, mtime }.
function parseTouched(text) {
  const lines = String(text ?? "").split("\n");
  if (lines[0]?.startsWith("NONE") || !lines[0]?.startsWith("KEY ")) return { none: true };
  const key = lines[0].slice(4);
  const mtime = Number(key.split(" ").slice(-2)[0]) * 1000;
  if (lines[1] === "SAME") return { same: true, key, mtime };
  const order = [];
  for (const line of lines.slice(1)) {
    const m = line.match(/\/openspec\/changes\/([^/"]+)$/);
    if (!m) continue;
    const i = order.indexOf(m[1]);
    if (i >= 0) order.splice(i, 1);
    order.push(m[1]);
  }
  return { key, mtime, names: order };
}
// The touched changes that exist on disk, newest touch first, at most `max`. touched: names, oldest touch first.
function pickTouched(entries, touched, max = MAX_ITEMS) {
  const byName = new Map(newestPerName(entries).map((e) => [e.name, e]));
  return (touched || []).filter((n) => byName.has(n)).reverse().map((n) => byName.get(n)).slice(0, max);
}
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const age = (ms) => {
  const m = Math.max(0, Math.floor(ms / 60_000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
};
// Longest name shown: roomy for a lone change, tight when two share the bar.
const nameMax = (count) => (count <= 1 ? 40 : 20);
// Display parts for one item: name and done/total in white ("hi"), the age dim.
function itemParts(e, now, max = nameMax(MAX_ITEMS)) {
  return [
    { text: clip(e.name, max), tone: "hi" },
    { text: `${e.done}/${e.total}`, tone: "hi" },
    { text: age(now - e.mtime), tone: "dim" },
  ];
}
// What to say when there are no items to show; "nosession" | "nottouched" | "noproject".
const emptyText = (source) =>
  source === "nottouched" ? "spectra: this session touched no change" : source === "noproject" ? "spectra: no openspec here" : "spectra: no session";
// --- end pure logic ---

const SCAN_SCRIPT = String.raw`R="$1"
for f in "$R"/openspec/changes/*/tasks.md "$R"/.worktrees/*/openspec/changes/*/tasks.md "$R"/*/.worktrees/*/openspec/changes/*/tasks.md; do
  [ -f "$f" ] || continue
  case "$f" in */archive/*) continue;; esac
  d=$(grep -c -E '^[[:space:]]*- \[[xX]\]' "$f"); o=$(grep -c -E '^[[:space:]]*- \[ \]' "$f")
  printf '%s\t%s\t%s\t%s\n' "$(stat -f %m "$f")" "$d" "$o" "$f"
done`;
const ROOT_SCRIPT = String.raw`for d in "$@"; do [ -d "$d/openspec/changes" ] && { echo "$d"; break; }; done`;
const TOUCH_SCRIPT = String.raw`cached="$1"; sid="$2"; shift 2
f=""
if [ -n "$sid" ]; then
  f=$(ls -t "$HOME"/.claude/projects/*/"$sid"*.jsonl 2>/dev/null | head -1)
fi
if [ -z "$f" ]; then
  for d in "$@"; do
    f=$(find "$d" -maxdepth 1 -name '*.jsonl' -mtime -1 2>/dev/null | xargs ls -t 2>/dev/null | head -1)
    [ -n "$f" ] && break
  done
fi
[ -z "$f" ] && { echo NONE; exit 0; }
key="$f $(stat -f '%m %z' "$f")"
echo "KEY $key"
[ "$key" = "$cached" ] && { echo SAME; exit 0; }
grep -o -E '"file_path":"[^"]*/openspec/changes/[^/"]+' "$f" | sed 's/^"file_path":"//'`;

export default class SpectraStatus extends View {
  init(_props, cx) {
    this.term = undefined;    // focused terminal we last refreshed for
    this.cwd = null;
    this.view = { items: [], source: "nosession" };
    this.touchKey = "";
    this.touched = null;      // { names, mtime, viaId }
    this.lastKey = "";
    this.lastScan = 0;
    this.busy = false;
    this.dirty = false;
    this.tick(cx);
    cx.timer.every(TICK_MS, (cx) => this.tick(cx));
  }

  // Cheap and local: runs every TICK_MS; only a terminal switch or RESCAN_MS triggers the exec work.
  tick(cx) {
    const f = focused();
    const term = f?.terminal ?? null;
    if (term && term !== this.term) { this.term = term; this.cwd = f.cwd ?? this.cwd; this.dirty = true; }
    if (!this.term) return;
    if (!this.dirty && Date.now() - this.lastScan < RESCAN_MS) return;
    this.run(cx);
  }

  run(cx) {
    if (this.busy) return;       // a switch during a refresh sets `dirty`, so it reruns right after
    this.busy = true;
    this.dirty = false;
    const term = this.term;
    cx.spawn(async (cx) => {
      try { await this.refresh(term); } catch { /* keep what is shown */ }
      this.busy = false;
      this.lastScan = Date.now();
      this.touch(cx);
      if (this.dirty || this.term !== term) this.run(cx);
    });
  }

  async refresh(term) {
    let info = null;
    try { info = parseHcLs((await hc(["ls"])).stdout, term); } catch { /* fall back to focused() cwd */ }
    const cwd = info?.cwd ?? this.cwd;
    const claude = isClaude(info);
    if (!claude || !cwd) { this.view = { items: [], source: "nosession" }; return; }
    let sid = null;
    try { sid = extractSessionId((await hc(["read", term])).stdout); } catch { /* guess from cwd below */ }
    const up = ancestors(cwd);
    const wt = worktreeParent(cwd);
    const rootOut = await exec("sh", ["-c", ROOT_SCRIPT, "sh", ...(wt ? [wt, ...up] : up)]);
    const root = rootOut.stdout.trim().split("\n")[0] || null;
    if (!root) { this.view = { items: [], source: "noproject" }; return; }
    const entries = parseScan((await exec("sh", ["-c", SCAN_SCRIPT, "sh", root])).stdout);
    const projects = `${home()}/.claude/projects`;
    const dirs = up.map((d) => `${projects}/${encodeProjectDir(d)}`);
    const t = parseTouched((await exec("sh", ["-c", TOUCH_SCRIPT, "sh", this.touchKey, sid ?? "", ...dirs])).stdout);
    if (t.none) { this.touched = null; this.touchKey = ""; this.view = { items: [], source: "nosession" }; return; }
    if (!t.same) { this.touchKey = t.key; this.touched = { names: t.names, mtime: t.mtime, viaId: Boolean(sid) && t.key.includes(`/${sid}`) }; }
    const tt = this.touched;
    const items = pickTouched(entries, tt.names);
    this.view = { items, source: items.length ? (tt.viaId ? "session" : "guess") : "nottouched" };
  }

  parts() {
    const now = Date.now();
    const { items, source } = this.view;
    if (!items.length) return [{ text: emptyText(source), tone: "dim" }];
    const out = source === "guess" ? [{ text: "~", tone: "warn" }] : [];
    items.forEach((e, i) => {
      if (i) out.push({ text: "│", tone: "dim" });
      out.push(...itemParts(e, now, nameMax(items.length)));
    });
    return out;
  }

  touch(cx) {
    const key = JSON.stringify(this.parts());
    if (key !== this.lastKey) { this.lastKey = key; cx.notify(); }
  }

  render(cx) {
    const t = theme();
    const color = { hi: t.ansi15, dim: t.dim, warn: t.ansi3 };
    return h_flex().size_full().px(14).gap(8).items_center().justify_center().bg(t.chrome).border_t(1).border_color(t.border)
      .text_size(11.8).text_color(t.muted)
      .children(this.parts().map((p) => div().flex_none().text_color(color[p.tone]).child(p.text)));
  }
}

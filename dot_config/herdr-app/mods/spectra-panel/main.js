// Spectra panel: a floating drawer on the right edge (center), shown only while the focused terminal's folder
// sits inside a project that has openspec/changes. Idle it is a 36px strip with the number of active changes;
// hovering slides the drawer out: project, active and parked changes with done/total, and spec / archived counts.
// Clicking a change opens its tasks.md in VS Code, in the window that has the project root open.
//
// Data: the `spectra` CLI (list --json, --parked --json, --specs --json), run in the project root; the archived
// count is the number of folders in openspec/changes/archive. Read-only apart from launching VS Code.
// It is a floating block of the layout (see "floating" on work-body in layouts/shawn-style.json).

import { View, div, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme, settings, exec, focused, placement } from "herdr";

const TICK_MS = 1_000;
const HOVER_MS = 100;
const RESCAN_MS = 5_000;
const PEEK = 34;           // width of the strip that always shows; must match "peek" in the layout (fits the mark and two digits)
const DRAWER_W = 360;      // width of the part that slides out on hover
const ROW_H = 30;
const MARK_H = 22;         // height of the collapsed mark; the frame hugs it
const CODE = "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code";

// --- pure logic (tested outside Herdr by extracting this block; keep it free of imports) ---
const num = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
// The list under `key` of one `spectra list --json` reply -> [{ name, done, total, status }]. Bad input -> null
// (so the caller keeps what it had); malformed entries are skipped.
function parseChanges(text, key) {
  let j;
  try { j = JSON.parse(text); } catch { return null; }
  const list = j?.[key];
  if (!Array.isArray(list)) return null;
  return list
    .filter((c) => c && typeof c.name === "string" && c.name)
    .map((c) => ({ name: c.name, done: num(c.completedTasks), total: num(c.totalTasks), status: typeof c.status === "string" ? c.status : key }));
}
// `spectra list --specs --json` -> number of specs, or null when unreadable.
function parseSpecCount(text) {
  try { const l = JSON.parse(text)?.specs; return Array.isArray(l) ? l.length : null; } catch { return null; }
}
// Output of `ls archive | wc -l` -> number, or null.
function parseCount(text) {
  const n = parseInt(String(text ?? "").trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
const pct = (done, total) => (total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0);
const baseName = (p) => String(p ?? "").replace(/\/+$/, "").split("/").pop() || "";
// Badge state, from what is known. "unknown" (not read yet) | "idle" (nothing in progress, nothing parked)
// | "parked" (only parked changes) | "pending" (changes in progress, but no task done in any of them yet)
// | "active" (at least one task done somewhere, not all) | "done" (every task of every active change done).
function badgeState(changes, parked) {
  if (changes == null) return "unknown";
  if (changes.length === 0) return parked && parked.length > 0 ? "parked" : "idle";
  if (changes.every((c) => c.total > 0 && c.done >= c.total)) return "done";
  return changes.some((c) => c.done > 0) ? "active" : "pending";
}
// Badge colours follow the agent status colours: in progress = working (blue), all done = done (green),
// only parked = the dimmed amber agents use for a wait that was set aside, not started = a muted blue-grey,
// nothing / unknown = grey.
const STATE_TONE = { active: "working", pending: "pending", done: "done", parked: "parked", idle: "idle", unknown: "idle" };
const stateTone = (state) => (Object.hasOwn(STATE_TONE, state) ? STATE_TONE[state] : "idle");
// Used only when the theme lacks the field (same hexes as the agent palette in spaces-agents; dark, light).
const FALLBACK = { working: ["#4C8DFF", "#2F7BF5"], done: ["#3FCF6E", "#34C759"], parked: ["#A47220", "#E6C27A"], pending: ["#5C6B8A", "#8A97B3"], idle: ["#8B93B5", "#6B7280"] };
// The colour for a tone: theme().working / .done when present, the dimmed amber for parked, grey for idle.
function toneColor(tone, theme, dark = true) {
  const pick = (name) => FALLBACK[name][dark === false ? 1 : 0];
  const th = theme ?? {};
  if (tone === "working") return th.working || pick("working");
  if (tone === "done") return th.done || pick("done");
  if (tone === "parked") return pick("parked");
  if (tone === "pending") return pick("pending");
  return th.muted || pick("idle");
}
// What the drawer shows. Each argument may be null (unknown); unknown counts print as "?" and never as 0.
function buildModel({ root, changes, parked, specs, archived }) {
  const active = changes ?? [];
  const park = parked ?? [];
  const rows = [
    ...active.map((c) => ({ ...c, parked: false, pct: pct(c.done, c.total) })),
    ...park.map((c) => ({ ...c, parked: true, pct: pct(c.done, c.total) })),
  ];
  const q = (v) => (v == null ? "?" : String(v));
  const state = badgeState(changes, parked);
  return {
    title: baseName(root),
    badge: changes == null ? "–" : String(active.length),
    state,
    rows,
    stats: [
      { label: "active", value: q(changes == null ? null : active.length) },
      { label: "parked", value: q(parked == null ? null : park.length) },
      { label: "specs", value: q(specs) },
      { label: "archived", value: q(archived) },
    ],
  };
}
// Where a change's tasks.md can live: in the tree, or (parked) in Spectra's store under .git.
const tasksCandidates = (root, name) => [
  `${root}/openspec/changes/${name}/tasks.md`,
  `${root}/.git/spectra-app/changes/${name}/tasks.md`,
  `${root}/openspec/.git/spectra-app/changes/${name}/tasks.md`,
];
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
// --- end pure logic ---

const ROOT_SCRIPT = String.raw`for d in "$@"; do [ -d "$d/openspec/changes" ] && { echo "$d"; break; }; done`;
const COUNT_SCRIPT = String.raw`ls "$1/openspec/changes/archive" 2>/dev/null | wc -l`;
const FIND_SCRIPT = String.raw`for f in "$@"; do [ -f "$f" ] && { echo "$f"; exit 0; }; done; exit 1`;

function ancestors(cwd) {
  const out = [];
  let p = String(cwd || "").replace(/\/+$/, "");
  while (p && p !== "/") { out.push(p); p = p.slice(0, p.lastIndexOf("/")); }
  return out;
}

export default class SpectraPanel extends View {
  init(_props, cx) {
    this.cwd = null;
    this.rootOf = new Map();   // cwd -> project root or null
    this.root = null;
    this.data = { changes: null, parked: null, specs: null, archived: null };
    this.lastKey = "";
    this.lastScan = 0;
    this.busy = false;
    this.dirty = false;
    this.hovered = false;
    this.tick(cx);
    cx.timer.every(TICK_MS, (cx) => this.tick(cx));
    // Cheap and local: redraw the moment the pointer enters or leaves, so the strip is only as tall as its badge
    // until hovered (otherwise the floating frame is as tall as the whole drawer and shows as an empty pill).
    cx.timer.every(HOVER_MS, (cx) => {
      const h = Boolean(placement()?.hovered);
      if (h !== this.hovered) { this.hovered = h; cx.notify(); }
    });
  }

  tick(cx) {
    const c = focused()?.cwd;
    if (c && c !== this.cwd) { this.cwd = c; this.dirty = true; }
    if (!this.cwd) return;
    if (!this.dirty && Date.now() - this.lastScan < RESCAN_MS) return;
    this.run(cx);
  }

  run(cx) {
    if (this.busy) return;
    this.busy = true;
    this.dirty = false;
    const cwd = this.cwd;
    cx.spawn(async (cx) => {
      try { await this.refresh(cwd); } catch { /* keep what is shown */ }
      this.busy = false;
      this.lastScan = Date.now();
      this.touch(cx);
      if (this.dirty) this.run(cx);
    });
  }

  async refresh(cwd) {
    if (!this.rootOf.has(cwd)) {
      const r = await exec("sh", ["-c", ROOT_SCRIPT, "sh", ...ancestors(cwd)]);
      this.rootOf.set(cwd, r.stdout.trim().split("\n")[0] || null);
    }
    const root = this.rootOf.get(cwd);
    if (root !== this.root) { this.root = root; this.data = { changes: null, parked: null, specs: null, archived: null }; }
    if (!root) return;
    const run = (args) => exec("spectra", args, { cwd: root, timeout: 15_000 }).then((r) => (r.code === 0 ? r.stdout : null)).catch(() => null);
    const [a, p, s, n] = await Promise.all([
      run(["list", "--json"]), run(["list", "--parked", "--json"]), run(["list", "--specs", "--json"]),
      exec("sh", ["-c", COUNT_SCRIPT, "sh", root]).then((r) => r.stdout).catch(() => null),
    ]);
    // A reply that cannot be read keeps the previous value.
    this.data = {
      changes: (a && parseChanges(a, "changes")) ?? this.data.changes,
      parked: (p && parseChanges(p, "parked")) ?? this.data.parked,
      specs: (s && parseSpecCount(s)) ?? this.data.specs,
      archived: parseCount(n) ?? this.data.archived,
    };
  }

  // Open the change's tasks.md in the VS Code window that has the project root open.
  open(name, cx) {
    const root = this.root;
    if (!root) return;
    cx.spawn(async () => {
      const found = await exec("sh", ["-c", FIND_SCRIPT, "sh", ...tasksCandidates(root, name)]).catch(() => null);
      const file = found?.code === 0 ? found.stdout.trim() : null;
      const r = await exec(CODE, file ? [root, file] : [root]).catch(() => null);
      if (!r || r.code !== 0) await exec("open", ["-a", "Visual Studio Code", file ?? root]).catch(() => null);
    });
  }

  model() { return buildModel({ root: this.root, ...this.data }); }

  touch(cx) {
    const key = JSON.stringify([this.root, this.model()]);
    if (key !== this.lastKey) { this.lastKey = key; cx.notify(); }
  }

  render(cx) {
    if (!this.root) return div();   // not a Spectra project: no size, nothing drawn
    const t = theme();
    const m = this.model();
    const onRight = (placement()?.edge ?? "right") === "right";
    // The mark: a line prism (one spec fanning out into its tasks) and the number of active changes, drawn in the
    // state's colour, the same as the agent status colours: blue = in progress, green = all done, dim amber = only parked,
    // grey = nothing / unknown.
    const tone = toneColor(stateTone(m.state), t, settings()?.dark);
    const mark = h_flex().w(PEEK).h(MARK_H).flex_none().items_center().justify_center().gap(2).text_color(tone)
      .child(svg("mods/spectra-panel/prism.svg").size(16).flex_none().text_color(tone))
      .child(div().flex_none().text_size(12).font_semibold().text_color(tone).child(m.badge));
    const strip = v_flex().w(PEEK).py(2).child(mark);
    if (!this.hovered) return strip;   // collapsed: just the badge, as small as it can be
    const stats = h_flex().gap(10).px(10).h(ROW_H).items_center().text_size(11.5).text_color(t.muted)
      .child(div().text_color(t.ansi15).font_semibold().child(m.title))
      .children(m.stats.map((s) => h_flex().flex_none().gap(4).items_center()
        .child(div().text_color(t.foreground).child(s.value)).child(div().child(s.label))));
    const rows = m.rows.map((r) => {
      return h_flex().id(`sp-${r.parked ? "p" : "a"}-${r.name}`).h(ROW_H).px(10).gap(8).items_center().cursor_pointer()
        .hover((s) => s.bg(t.raised)).on_click((_e, cx) => this.open(r.name, cx))
        .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(t.ansi15).child(clip(r.name, 34)))
        .when(r.parked, (e) => e.child(div().flex_none().text_size(10.5).text_color(t.ansi3).child("parked")))
        .child(div().flex_none().w(34).text_size(11.5).text_color(t.ansi15).child(`${r.done}/${r.total}`))
        .child(div().flex_none().w(46).h(5).rounded(3).bg(t.border)
          .child(div().h(5).rounded(3).bg(r.parked ? t.ansi3 : t.ansi10).w(Math.round((46 * r.pct) / 100))));
    });
    const drawer = v_flex().w(DRAWER_W).py(4).bg(t.popover).rounded(8)
      .child(stats)
      .children(rows)
      .when(rows.length === 0 && this.data.changes != null, (e) => e.child(div().px(10).h(ROW_H).flex().items_center().text_size(12).text_color(t.foreground).child("no changes in progress")));
    return h_flex().items_start().children(onRight ? [drawer, strip] : [strip, drawer]);
  }
}

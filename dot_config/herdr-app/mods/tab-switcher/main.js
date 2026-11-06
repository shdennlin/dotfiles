// ctrl-tab switcher: a list of tabs, most recently used first, one row each. spaces-agents opens it and
// feeds it presses through shared "ts.*" values; holding ctrl and tapping tab walks the row,
// releasing ctrl goes to the chosen tab; ctrl+p hands over to the search picker. Esc (Herdr closes the dialog itself) leaves without going.
//
// Shared values (written by spaces-agents.switch / switch-back):
//   ts.recent  [{ space, tab }]  tabs, newest first (index 0 is the tab you are on)
//   ts.start   number            card selected when the switcher opened
//   ts.delta   number            presses since it opened, +1 forward / -1 back
//   ts.alive   number            heartbeat (ms), written here so spaces-agents knows we are open
//   ts.closed  number            when we went to a tab and closed (ms), so the next press opens a fresh one

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, spaces, panes, theme, settings, shared, setShared, run, exec, props, closeOverlay, home } from "herdr";

const PINK = "#ff79c6"; // Dracula pink, same as picker-cards
const SPIN = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]; // same braille spinner as the sidebar
const GRAY_AFTER_S = 6 * 3600; // an idle agent this old counts as long idle (same as the sidebar)
const ROW_H = 40, LIST_W = 560;
const PAL = { done: ["#34C759", "#3FCF6E"], read: ["#6FB58A", "#4A9B6B"], running: ["#2F7BF5", "#4C8DFF"], need: ["#E8920A", "#F5A524"] };
const pal = (name) => PAL[name][settings()?.dark === false ? 0 : 1];

// Same tab label rule as picker-cards and the sidebar.
function tabLabel(ctx, ps) {
  if (ctx.named) return ctx.name;
  const lead = ps.find((p) => p.tab === ctx.id && p.program?.agent);
  const live = (lead?.title ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();
  const telling = live && live !== lead.program.name && !/^[~/]|^[A-Za-z]:\\/.test(live) && !live.includes("@") && live.toLowerCase() !== lead.program.key;
  if (telling) return live;
  const any = ps.find((p) => p.tab === ctx.id && p.terminal);
  const dir = any?.cwd ? any.cwd.replace(/\/+$/, "").split("/").pop() : "";
  return dir || ctx.name;
}
// The agent's logo from Herdr's program table, same as the sidebar and picker-cards.
function logo(p, size, color) {
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}
// The state symbol at the row's right end, as in the sidebar: braille spinner while working, filled "!" when
// it needs you, filled check when done, outline check when idle, pause when long idle.
function badge(color, filled, glyph, t) {
  return div().w(14).h(14).flex_none().flex().items_center().justify_center().rounded(7)
    .border_1().border_color(color).when(filled, (e) => e.bg(color)).text_size(9).font_semibold()
    .text_color(filled ? (t.chrome ?? "#1b1d25") : color).child(glyph);
}
function statusGlyph(st, old, tone, t) {
  if (st === "working") return div().w(14).flex_none().text_color(tone).frames(SPIN, 90).child(SPIN[0]);
  if (st === "blocked") return badge(tone, true, "!", t);
  if (st === "done") return badge(tone, true, "✓", t);
  if (st === "idle") return old ? badge(t.muted, false, "‖", t) : badge(tone, false, "✓", t);
  return div().w(14).h(14).flex_none();
}
function shortDir(cwd) {
  if (!cwd) return "";
  const h = home();
  const p = (h && cwd.startsWith(h) ? "~" + cwd.slice(h.length) : cwd).replace(/\/+$/, "");
  return p.split("/").filter(Boolean).slice(-2).join("/") || p;
}
function ageLabel(s) {
  s = Math.max(0, Math.floor(s));
  if (s < 60) return "0m";
  if (s < 600) return `${Math.floor(s / 60)}m`;
  if (s < 6000) return `${Math.floor(s / 300) * 5}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.min(99, Math.floor(s / 86400))}d`;
}

export default class TabSwitcher extends View {
  init(_props, cx) {
    this.recent = shared("ts.recent") ?? [];
    this.start = Number(shared("ts.start")) || 0;
    this.done = false;
    this.shown = false; // draw nothing until we know ctrl is still down, so a quick tap never flashes the list
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.timer.after(150, () => this.handle.focus());
    this.beat();
    cx.timer.every(300, () => this.beat());
    // Presses arrive as a running total; redraw only when it moves.
    this.seen = Number(shared("ts.delta")) || 0;
    cx.timer.every(40, (cx) => {
      const d = Number(shared("ts.delta")) || 0;
      if (d !== this.seen) { this.seen = d; cx.notify(); }
    });
    // A quick tap releases ctrl before this window has the keyboard, so no release event ever
    // arrives. Ask the system right away whether ctrl is still down: free -> go now, held -> show.
    this.checkHeld(cx);
    cx.timer.after(500, (cx) => { if (!this.shown && !this.done) { this.shown = true; cx.notify(); } }); // probe failed: show anyway
  }

  beat() { setShared("ts.alive", Date.now()); }

  async checkHeld(cx) {
    if (this.done) return;
    try {
      const out = await exec("osascript", ["-l", "JavaScript", "-e", 'ObjC.import("CoreGraphics"); ($.CGEventSourceFlagsState(1) & 0x40000) ? "held" : "free"']);
      if (String(out?.stdout ?? out).trim() === "free") this.commit(cx);
      else if (!this.done) { this.shown = true; cx.notify(); }
    } catch { /* no way to ask: the release event or Esc still ends it */ }
  }

  index() {
    const n = this.recent.length || 1;
    return (((this.start + this.seen) % n) + n) % n;
  }

  // Resolve the stored ids against what exists now; tabs that were closed drop out.
  cards() {
    const all = spaces();
    const ag = agents();
    const ps = panes();
    const snap = shared("sa.snapshot") ?? {};
    const now = Date.now();
    return this.recent.map((r) => {
      const w = all.find((s) => s.id === r.space);
      const ctx = w?.tabs.find((x) => x.id === r.tab);
      if (!ctx) return null;
      const mine = ag.filter((a) => a.tab === ctx.id);
      const status = ctx.status; // the tab's own most-urgent status, same field picker-cards and the tab bar read
      const since = mine.map((a) => snap.info?.[a.address]).filter(Boolean).map((ms) => (now - ms) / 1000);
      return {
        w, ctx, status, mine,
        prog: mine[0]?.program,
        panelOnly: !ps.some((p) => p.tab === ctx.id && p.terminal) && ps.some((p) => p.tab === ctx.id),
        label: tabLabel(ctx, ps),
        dir: shortDir(ps.find((p) => p.tab === ctx.id && p.terminal)?.cwd),
        age: since.length ? Math.min(...since) : null,
      };
    }).filter(Boolean);
  }

  commit(cx) {
    if (this.done) return;
    this.done = true;
    const target = this.cards()[this.index()];
    setShared("ts.alive", 0);
    setShared("ts.closed", Date.now());
    closeOverlay(props().overlay);
    if (!target || target.ctx.active && target.w.active) return;
    if (!target.w.active) run("space.select", { id: target.w.id });
    run("tab.select", { id: target.ctx.id });
  }

  // ctrl+p while the switcher is up: leave without switching and open the search picker instead.
  // "pc.guard" tells picker-cards to ignore ctrl+d for a moment (ctrl is probably still held).
  search(cx) {
    if (this.done) return;
    this.done = true;
    setShared("ts.alive", 0);
    setShared("ts.closed", Date.now());
    setShared("pc.guard", Date.now());
    // Open the picker first, in this same tick: a timer would die with this view once it is closed.
    run("mod.open", { name: "picker-cards" });
    closeOverlay(props().overlay);
  }

  render() {
    const t = theme();
    if (!this.shown) return div().id("ts");
    const cards = this.cards();
    const at = Math.min(this.index(), Math.max(0, cards.length - 1));
    const tone = (st) => (st === "working" ? pal("running") : st === "blocked" ? pal("need") : st === "done" ? pal("done") : pal("read"));
    return v_flex().id("ts").track_focus(this.handle).w(LIST_W).p(8).gap(2).rounded(12).border_1().border_color(t.border ?? t.dim)
      .bg(t.chrome ?? t.background)
      .on_key_down((e, cx) => {
        if (e.key === "p" && e.modifiers.control) { this.search(cx); cx.stop_propagation(); }
      })
      .on_modifiers_changed((e, cx) => { if (!e.modifiers.control) this.commit(cx); })
      // Another key after ctrl went up (event missed): treat it as the release too.
      .on_key_up((e, cx) => { if (!e.modifiers.control) this.commit(cx); })
      .children(cards.map((c, i) => {
        const on = i === at;
        // Same rule as the sidebar: the name's color follows the state; long idle has none.
        const old = c.status === "idle" && c.age !== null && c.age > GRAY_AFTER_S;
        const accent = old ? t.muted : tone(c.status);
        return h_flex().h(ROW_H).flex_none().px(10).gap(10).items_center().rounded(8).border_1()
          .border_color(on ? PINK : (t.chrome ?? t.background)).bg(on ? `${PINK}1f` : (t.chrome ?? t.background))
          // Same marks as the sidebar: the agent's logo, ">_" for a shell, "▦" for a panel-only tab.
          .child(c.prog?.icon ? logo(c.prog, 18, c.status ? accent : t.foreground)
            : div().w(18).flex_none().text_size(12).text_color(t.dim).child(c.panelOnly ? "▦" : ">_"))
          .child(div().text_size(15).font_semibold().text_color(c.status ? accent : (on ? t.foreground : t.muted)).min_w(0).flex_1().truncate().child(c.label))
          .child(div().text_size(12.5).text_color(t.dim).flex_none().max_w(150).truncate().child(c.w.name + (c.w.machine ? ` · ${c.w.machine}` : "")))
          .child(statusGlyph(c.status, old, accent, t))
          .child(div().text_size(12.5).text_color(t.dim).flex_none().w(40).text_right().child(c.age !== null ? ageLabel(c.age) : ""));
      }));
  }
}

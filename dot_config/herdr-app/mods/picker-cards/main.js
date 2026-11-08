// Go to a tab, as cards: one card per space, one line per tab, machine headers above their cards.
// Age, memory and sub-agent counts come from the sidebar's shared "sa.snapshot" (see spaces-agents).
// Type to filter (non-matching rows dim, nothing moves), up/down walk the rows, left/right (ctrl+f / ctrl+b) jump
// between cards, Enter goes, ctrl+d closes the tab, Esc leaves.

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { exec, agents, spaces, panes, terminals, run, hc, theme, settings, props, closeOverlay, openOverlay, shared, setShared, home } from "herdr";

// State colors and the tab label rule are the same as the spaces-agents sidebar and the
// tabs-live tab bar (cmux-local's palette): done bright green, idle quiet green, working blue,
// needs-you amber. A tab nobody named shows its agent's live title, else its folder, not "5".
const PAL = {
  done: ["#34C759", "#3FCF6E"], read: ["#6FB58A", "#4A9B6B"], running: ["#2F7BF5", "#4C8DFF"],
  need: ["#E8920A", "#F5A524"],
};
const pal = (name) => PAL[name][settings()?.dark === false ? 0 : 1];

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

const MARK = { ansi6: "#22a99a", ansi3: "#e3814f", ansi4: "#5b8def", ansi5: "#8b7cf6", ansi2: "#3fae6a", ansi1: "#d9649a" };

// Space colors, kept by space id in shared "space.colors": a theme
// color name ("ansi6") or a picked #rrggbb. A space seen without one gets
// the theme color fewest spaces use, once; every mod does the same in the
// same order, so they agree, and adding or renaming spaces moves nothing.
const PROJECT_COLORS = ["ansi6", "ansi3", "ansi4", "ansi5", "ansi2", "ansi1"];
function spaceColors() {
  const ids = new Set(spaces().map((p) => p.id));
  const kept = Object.fromEntries(Object.entries(shared("space.colors") ?? {}).filter(([id]) => ids.has(id)));
  let changed = Object.keys(kept).length !== Object.keys(shared("space.colors") ?? {}).length;
  for (const p of spaces()) {
    if (kept[p.id] || p.name === "~") continue;
    const uses = (c) => Object.values(kept).filter((v) => v === c).length;
    kept[p.id] = PROJECT_COLORS.reduce((best, c) => (uses(c) < uses(best) ? c : best));
    changed = true;
  }
  if (changed) setShared("space.colors", kept);
  return kept;
}
function spaceColor(t, p) {
  if (p.name === "~") return t.dim;
  const c = spaceColors()[p.id] ?? PROJECT_COLORS[0];
  return c.startsWith("#") ? c : (MARK[c] ?? t[c]);
}

// Same buckets as the sidebar's age label (cmux's age_label): exact for 10 minutes, then coarser.
function ageLabel(s) {
  s = Math.max(0, Math.floor(s));
  if (s < 60) return "0m";
  if (s < 600) return `${Math.floor(s / 60)}m`;
  if (s < 6000) return `${Math.floor(s / 300) * 5}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.min(99, Math.floor(s / 86400))}d`;
}
function memLabel(kb) {
  const mb = kb / 1024;
  return mb < 1024 ? `${Math.round(mb / 50) * 50}M` : `${(mb / 1024).toFixed(1)}G`;
}
// "~/m/project/foo" -> "project/foo": the last two folders say enough.
function shortDir(cwd) {
  if (!cwd) return "";
  const h = home();
  const p = (h && cwd.startsWith(h) ? "~" + cwd.slice(h.length) : cwd).replace(/\/+$/, "");
  return p.split("/").filter(Boolean).slice(-2).join("/") || p;
}

// Fuzzy match: the letters of `f` must appear in order in `text` (case-insensitive). A run of
// consecutive letters beats scattered ones; the start of the text and of a word count extra.
// Returns { score, pos } (pos: matched character indexes) or null.
function fuzzy(text, f) {
  const t = text.toLowerCase();
  const at = t.indexOf(f);
  if (at >= 0) {
    return { score: 1000 - at - t.length * 0.01 + (at === 0 ? 50 : 0), pos: Array.from({ length: f.length }, (_, i) => at + i) };
  }
  const pos = [];
  let from = 0;
  for (const ch of f) {
    const i = t.indexOf(ch, from);
    if (i < 0) return null;
    pos.push(i);
    from = i + 1;
  }
  let score = 100 - (pos[pos.length - 1] - pos[0]); // tighter is better
  pos.forEach((i, k) => {
    if (k > 0 && i === pos[k - 1] + 1) score += 15;
    if (i === 0 || !/[\p{L}\p{N}]/u.test(t[i - 1])) score += 8;
  });
  return { score: Math.min(score, 900), pos };
}
// How well a row matches: the best of its fields (the tab's own name counts most).
function rate(f, p) {
  let best = null;
  for (const [text, penalty] of [[p.label, 0], [p.name, 0], [p.dir, -10], [p.who, -10], [p.space, -20], [p.machine, -30]]) {
    const r = text ? fuzzy(text, f) : null;
    if (r && (best === null || r.score + penalty > best)) best = r.score + penalty;
  }
  return { match: best !== null, score: best ?? -1 };
}

const PINK = "#ff79c6"; // Dracula pink
const ROW = 34, HEAD = 36, MACHINE = 30, GAP = 10, PAD = 8, LIST_MAX = 760;
const SPIN = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]; // same braille spinner as the sidebar
const GRAY_AFTER_S = 6 * 3600; // an idle agent this old counts as long idle (same as the sidebar)

// The agent's logo from Herdr's program table, same as the sidebar: a one-color glyph drawn in
// `color`, or a picture.
function logo(p, size, color) {
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}
const FONT = { name: 15, detail: 12.5, head: 14, machine: 13 };

const US_SOURCE = "com.apple.keylayout.US";

export default class PickerCards extends View {
  init(_props, cx) {
    this.filter = "";
    this.at = null;
    this.w = 1000;
    this.input = InputState.new({ placeholder: "Search tabs, spaces, agents, folders…" });
    this.input.on("change", (_e, cx) => {
      this.filter = this.input.value();
      const rows = this.flat();
      let best = -1;
      rows.forEach((r, i) => { if (r.match && (best === -1 || r.score > rows[best].score)) best = i; });
      this.at = Math.max(0, best);
      cx.notify();
    });
    // Enter goes only to a row that matches the search; with nothing matching it does nothing.
    this.input.on("submit", () => { const r = this.flat()[this.at]; if (r?.match) this.go(r); });
    // Switch to the U.S. layout while the panel is open; close() puts the previous source back.
    this.imRestored = false;
    this.imChain = exec("im-select").then((r) => {
      const prev = r.stdout.trim();
      if (prev && prev !== US_SOURCE) { this.imPrev = prev; return exec("im-select", [US_SOURCE]); }
    }).catch(() => {});
    this.input.focus();
    cx.timer.after(600, () => this.input.focus());
    cx.timer.every(5000, (cx) => cx.notify()); // ages tick on
    this.handle = cx.focus_handle();
  }

  restoreInput() {
    if (this.imRestored) return;
    this.imRestored = true;
    this.imChain.then(() => { if (this.imPrev) return exec("im-select", [this.imPrev]); }).catch(() => {});
  }

  close() { this.restoreInput(); closeOverlay(props().overlay); }

  go(r) {
    if (!r) return;
    this.close();
    run("tab.select", { id: r.ctx.id });
  }

  // sections: [{ m: machine|null, cards: [{ w, agents, mem, ci, rows: [row] }] }], in display order.
  model() {
    const f = this.filter.toLowerCase();
    const all = agents();
    const live = terminals().filter((x) => x.state === "live");
    const ps = panes();
    const snap = shared("sa.snapshot") ?? {};
    const now = Date.now();
    const sum = (xs) => (xs.length ? xs.reduce((x, y) => x + y, 0) : null);
    const teamOf = (addrs) => {
      let n = 0;
      const walk = (a) => live.filter((x) => x.parent === a).forEach((k) => (n++, walk(k.address)));
      addrs.forEach(walk);
      return n;
    };
    const cards = spaces().map((w) => {
      const inSpace = all.filter((a) => a.space === w.id);
      const rows = w.tabs.map((ctx) => {
        const mine = all.filter((a) => a.tab === ctx.id);
        const since = mine.map((a) => snap.info?.[a.address]).filter(Boolean).map((ms) => (now - ms) / 1000);
        const dir = shortDir(ps.find((p) => p.tab === ctx.id && p.terminal)?.cwd);
        const label = tabLabel(ctx, ps);
        const panelOnly = !ps.some((p) => p.tab === ctx.id && p.terminal) && ps.some((p) => p.tab === ctx.id);
        const hit = f ? rate(f, { label, name: ctx.name, dir, who: mine.map((a) => a.program?.name ?? "").join(" "), space: w.name, machine: w.machine ?? "" }) : { match: true, score: 0 };
        return {
          w, ctx, mine, dir, label, panelOnly,
          match: hit.match,
          score: hit.score,
          team: teamOf(mine.map((a) => a.address)),
          tasks: mine.reduce((n, a) => n + (snap.tasks?.[a.address] ?? 0), 0),
          age: since.length ? Math.min(...since) : null,
          mem: sum(mine.map((a) => snap.rss?.[a.address]).filter((v) => v !== undefined)),
        };
      });
      return { w, rows, agents: inSpace.length, mem: sum(inSpace.map((a) => snap.rss?.[a.address]).filter((v) => v !== undefined)) };
    }).filter((c) => c.rows.length);
    const remote = [...new Set(cards.map((c) => c.w.machine).filter(Boolean))].sort();
    const order = (list) => [...list.filter((c) => c.w.status), ...list.filter((c) => !c.w.status)]
      .sort((a, b) => (b.w.status === "blocked") - (a.w.status === "blocked"));
    const sections = [null, ...remote].map((m) => ({ m, cards: order(cards.filter((c) => (c.w.machine ?? null) === m)) }))
      .filter((s) => s.cards.length);
    let ci = 0;
    sections.forEach((s) => s.cards.forEach((c) => { c.ci = ci++; c.rows.forEach((r, i) => { r.ci = c.ci; r.rowIndex = i; }); }));
    return { sections, grouped: remote.length > 0 };
  }

  flat() { return this.model().sections.flatMap((s) => s.cards.flatMap((c) => c.rows)); }

  badge(color, filled, glyph, t) {
    return div().w(14).h(14).flex_none().flex().items_center().justify_center().rounded(7)
      .border_1().border_color(color).when(filled, (e) => e.bg(color)).text_size(9).font_semibold()
      .text_color(filled ? (t.chrome ?? "#1b1d25") : color).child(glyph);
  }

  // Same rule as the sidebar: the name's color follows the state; long idle has none.
  tone(st, old, t) {
    if (old) return t.muted;
    if (st === "working") return pal("running");
    if (st === "blocked") return pal("need");
    if (st === "done") return pal("done");
    return pal("read");
  }

  // The state symbol at the row's right end. Only what needs you gets a filled badge ("!" blocked,
  // check done); a quiet idle is a bare check, and long idle draws nothing (the age already says it).
  statusGlyph(st, old, tone, t) {
    const check = (size, color) => svg("mods/picker-cards/check.svg").size(size).flex_none().text_color(color);
    if (st === "working") return div().w(14).flex_none().text_color(tone).frames(SPIN, 90).child(SPIN[0]);
    if (st === "blocked") return this.badge(tone, true, "!", t);
    if (st === "done") return div().w(14).h(14).flex_none().flex().items_center().justify_center().rounded(7).bg(tone).child(check(9, t.chrome ?? "#1b1d25"));
    if (st === "idle" && !old) return div().w(14).h(14).flex_none().flex().items_center().justify_center().child(check(12, tone));
    return div().w(14).h(14).flex_none();
  }

  render() {
    const t = theme();
    const PANEL = t.chrome ?? t.popover; // one panel color, same as the ctrl-tab switcher
    const { sections, grouped } = this.model();
    const flat = sections.flatMap((s) => s.cards.flatMap((c) => c.rows));
    const cardList = sections.flatMap((s) => s.cards);
    if (this.at === null) this.at = Math.max(0, flat.findIndex((r) => r.w.active && r.ctx.active));
    this.at = Math.max(0, Math.min(this.at, flat.length - 1));
    const sel = flat[this.at];
    const noMatch = Boolean(this.filter) && !flat.some((r) => r.match);

    const cols = Math.max(1, Math.min(3, Math.floor((this.w - 36) / 320)));
    const cardH = (c) => HEAD + c.rows.length * ROW + PAD;
    const pack = (cards) => {
      const columns = Array.from({ length: cols }, () => ({ h: 0, cards: [] }));
      for (const c of cards) {
        const col = columns.reduce((b, x) => (x.h < b.h ? x : b));
        col.cards.push(c);
        col.h += cardH(c) + GAP;
      }
      return columns;
    };
    const packed = sections.map((s) => ({ ...s, columns: pack(s.cards) }));
    // Where every card sits (y from the top of the content), to scroll the selected row into view.
    const top = {};
    let y = 0;
    packed.forEach((s) => {
      const base = y + (grouped ? MACHINE + 6 : 0);
      s.columns.forEach((col) => {
        let cy = base;
        col.cards.forEach((c) => { top[c.ci] = cy; cy += cardH(c) + GAP; });
      });
      y = base + Math.max(...s.columns.map((c) => c.h)) + 10;
    });
    const total = y + 8;
    const listH = Math.min(LIST_MAX, total);
    const maxScroll = Math.max(0, total - listH);
    this.maxScroll = maxScroll;
    this.scroll = Math.max(0, Math.min(this.scroll ?? 0, maxScroll));
    // Only a change of the selection moves the view; the wheel is free to scroll away from it.
    if (sel && this.scrolledFor !== this.at) {
      const cardTop = top[sel.ci] ?? 0;
      const rowTop = cardTop + HEAD + 2 + sel.rowIndex * ROW;
      if (rowTop < this.scroll + 4) this.scroll = Math.max(0, cardTop - 4);
      else if (rowTop + ROW > this.scroll + listH - 4) this.scroll = Math.min(maxScroll, rowTop + ROW - listH + 8);
      this.scrolledFor = this.at;
    }

    // Text with the part that matches the search marked (accent chip, like a button); plain without a search.
    const f = this.filter.toLowerCase();
    // Search highlight: Dracula pink (#ff79c6, the theme's pink) at three strengths.
    //   row wash ~12%, matched letters ~28%, the keyboard selection's outline solid.
    const wash = `${PINK}1f`;
    const chip = `${PINK}47`;
    const mark = (text, o) => {
      const hit = f ? fuzzy(text, f) : null;
      const sizeIt = (e) => e.text_size(o.size).text_color(o.color).when(o.bold, (d) => d.font_semibold());
      const box = (e) => (o.grow ? e.flex_1().min_w(0) : e.flex_none().min_w(0).max_w(o.max ?? 999));
      if (!hit) return sizeIt(box(div().truncate()).child(text));
      const on = new Set(hit.pos);
      const runs = [];
      for (let i = 0; i < text.length; i++) {
        const m = on.has(i);
        if (!runs.length || runs[runs.length - 1].m !== m) runs.push({ m, s: "" });
        runs[runs.length - 1].s += text[i];
      }
      return box(h_flex().overflow_hidden()).children(runs.map((g) => (g.m
        ? div().flex_none().rounded(3).bg(chip).text_color(t.foreground).text_size(o.size).font_semibold().child(g.s)
        : sizeIt(div().flex_none()).child(g.s))));
    };

    const rowEl = (r) => {
      const on = r === sel && !noMatch;
      const dim = !r.match;
      const subs = r.tasks + r.team;
      const who = r.mine.map((a) => a.program?.name ?? "agent").join(" · ");
      const here = r.w.active && r.ctx.active;
      const st = r.ctx.status;
      const old = st === "idle" && r.age !== null && r.age > GRAY_AFTER_S;
      const tone = this.tone(st, old, t);
      const prog = r.mine[0]?.program;
      return h_flex()
        .id(`pc-${r.ctx.id}`)
        .h(ROW).px(8).gap(8).items_center().rounded(6).cursor_pointer()
        .when(f && !dim && !on, (el) => el.bg(wash))
        // The keyboard selection: an accent outline (same purple as the search box) over the selected
        // background. Hover alone is only the faint background, so the two can't be mixed up.
        .border_1().border_color(on ? PINK : PANEL)
        .when(on, (el) => el.bg(`${PINK}1f`)) // same light pink as the ctrl-tab switcher
        .hover((s) => s.bg(t.hover))
        .on_click(() => this.go(r))
        // Same marks as the sidebar: the agent's logo, ">_" for a shell, "▦" for a panel-only tab.
        .child(prog?.icon ? logo(prog, 17, old ? t.dim : t.foreground)
          : div().w(17).flex_none().text_size(12).text_color(t.dim).child(r.panelOnly ? "▦" : ">_"))
        .child(mark(r.label ?? r.ctx.name, { grow: true, size: FONT.name, color: st ? tone : t.muted, bold: here }))
        .when(r.dir && (r.dir.split("/").pop() !== r.label || (f && fuzzy(r.dir, f) && !fuzzy(String(r.label ?? ""), f))), (el) => el.child(mark(r.dir, { size: FONT.detail, color: t.dim, max: cols >= 3 ? 120 : 170 })))
        .when(Boolean(who) && (who !== "Claude Code" || (f && fuzzy(who, f))), (el) => el.child(mark(who, { size: FONT.detail, color: t.dim })))
        .when(subs > 0, (el) => el.child(div().flex_none().text_size(FONT.detail).text_color(t.muted).child(`+${subs}`)))
        .when(r.mem, (el) => el.child(div().flex_none().w(44).text_right().text_size(FONT.detail).text_color(t.dim).child(memLabel(r.mem))))
        .child(div().flex_none().w(32).text_right().text_size(FONT.detail).text_color(st ? tone : t.dim).child(r.age === null ? "" : ageLabel(r.age)))
        .child(this.statusGlyph(st, old, tone, t));
    };

    const cardEl = (c) => {
      const stat = [c.agents ? `${c.agents} agent${c.agents > 1 ? "s" : ""}` : "", c.mem ? memLabel(c.mem) : ""].filter(Boolean).join(" · ");
      return v_flex().id(`pcard-${c.w.id}`).w_full().rounded(10).border_1().border_color(t.border).bg(PANEL).pb(PAD / 2)
        .child(h_flex().h(HEAD).px(10).gap(8).items_center().border_b(1).border_color(t.border)
          .child(div().w(12).flex_none().text_right().text_size(FONT.detail).text_color(t.dim).child(String(c.w.index ?? "")))
          .child(h_flex().size(20).flex_none().rounded(6).bg(spaceColor(t, c.w)).items_center().justify_center().text_size(11).font_bold().text_color("#ffffff").child([...c.w.name][0]?.toUpperCase() ?? "?"))
          .child(mark(c.w.name, { grow: true, size: FONT.head, color: t.foreground, bold: true }))
          .child(div().flex_none().text_size(FONT.detail).text_color(t.dim).child(stat)))
        .child(v_flex().px(4).pt(2).children(c.rows.map(rowEl)));
    };

    const sectionEl = (s) => v_flex().gap(6)
      .when(grouped, (el) => el.child(h_flex().h(MACHINE).px(4).gap(7).items_center().text_size(FONT.machine).text_color(t.dim)
        .child(svg(`mods/workspace-chrome/${s.m ? "server" : "monitor"}.svg`).size(14).flex_none())
        .child(s.m ?? "This computer")))
      .child(h_flex().gap(GAP).items_start()
        .children(s.columns.map((col, i) => v_flex().id(`pcol-${s.m ?? "here"}-${i}`).flex_1().min_w(0).gap(GAP).children(col.cards.map(cardEl)))));

    return v_flex()
      .id("picker-cards")
      .track_focus(this.handle)
      .w_full().min_h(0).p(18).gap(10).bg(PANEL).text_size(13)
      .on_key_down((e, cx) => {
        const k = e.key;
        if (k === "escape") return this.close();
        const ctrl = e.modifiers.control;
        // Moving only visits rows that match the search (every row matches while the box is empty);
        // with nothing matching the selection stays where it is.
        const hits = flat.flatMap((r, i) => (r.match ? [i] : []));
        const step = (dir) => {
          if (!hits.length) return;
          const pos = hits.indexOf(this.at);
          this.at = hits[pos === -1 ? (dir > 0 ? 0 : hits.length - 1) : (pos + dir + hits.length) % hits.length];
        };
        if (k === "down" || (ctrl && k === "n")) step(1);
        else if (k === "up" || (ctrl && k === "p")) step(-1);
        else if (k === "right" || k === "left" || (ctrl && (k === "f" || k === "b"))) {
          // Cards with at least one match; land on that card's first matching row.
          const live = cardList.filter((c) => c.rows.some((r) => r.match));
          if (live.length) {
            const dir = k === "right" || k === "f" ? 1 : -1;
            const pos = live.findIndex((c) => c.ci === sel?.ci);
            const card = live[pos === -1 ? (dir > 0 ? 0 : live.length - 1) : (pos + dir + live.length) % live.length];
            this.at = flat.findIndex((r) => r.ci === card.ci && r.match);
          }
        } else if (k === "d" && e.modifiers.control) {
          // Just handed over from the ctrl-tab switcher, ctrl is likely still held: don't close a tab by accident.
          if (Date.now() - (Number(shared("pc.guard")) || 0) < 500) return;
          if (sel?.match) { this.close(); run("tab.close", { id: sel.ctx.id }); }
        } else return;
        cx.stop_propagation();
        cx.notify();
      })
      .child(h_flex().items_center().child(div().flex_1().text_size(15).font_semibold().text_color(t.foreground).child("Go to…"))
        .child(div().text_size(11).text_color(t.dim).child("↑↓ / ctrl+n p move · ←→ / ctrl+f b card · Enter go · ctrl+d close tab · Esc")))
      .child(h_flex().h(36).flex_none().px(10).gap(8).items_center().rounded(9).border_1().border_color(t.accent).bg(t.background)
        .child(svg("mods/workspace-chrome/search.svg").size(15).text_color(t.dim))
        .child(Input.new(this.input).flex_1().h_full().text_size(12.8).text_color(t.foreground)))
      .when(noMatch, (el) => el.child(h_flex().h(28).px(4).items_center().text_size(13).text_color(t.muted).child(`No matches for “${this.filter}”`)))
      .child(v_flex().id("pc-list").h(listH).min_h(0).overflow_hidden()
        .on_size_change((size, cx) => {
          const w = size.width / settings().zoom;
          if (Math.abs(w - this.w) > 1) { this.w = w; cx.notify(); }
        })
        .on_scroll_wheel((e, cx) => {
          this.scroll = Math.max(0, Math.min((this.scroll ?? 0) - e.delta.y, this.maxScroll ?? 0));
          cx.notify();
        })
        .child(v_flex().absolute().left(0).right(0).top(-this.scroll).gap(10).children(packed.map(sectionEl))));
  }
}

// Go to a tab. Drops from the Terminals layout's space chip (popup, at: "top"). Spaces with
// something that needs you come first, quiet spaces (no agent running)
// fold into "earlier". Type to filter, ↑/↓ and Enter to go, ctrl+d to close
// a tab, Esc to leave. Last rows: new work (a tab here, a space on this
// computer or on each connected machine).

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { agents, spaces, panes, terminals, run, hc, theme, settings, props, closeOverlay, openOverlay, shared, setShared, home } from "herdr";

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

export default class Picker extends View {
  init(_props, cx) {
    this.filter = "";
    this.input = InputState.new({ placeholder: "Go to a tab, space or agent…" });
    this.input.on("change", (_e, cx) => { this.filter = this.input.value(); this.at = 0; cx.notify(); });
    this.input.on("submit", () => this.go(this.rows().filter(r => r.kind === "ctx" || r.kind === "new" || r.kind === "space")[this.at]));
    this.input.focus();
    cx.timer.after(600, () => this.input.focus());
    this.at = null;
    this.scroll = 0;
    this.showEarlier = false;
    this.machines = [];
    this.handle = cx.focus_handle();
    cx.spawn(async (cx) => {
      try {
        const r = await hc(["machine", "ls", "--json"]);
        if (r.code === 0) this.machines = (JSON.parse(r.stdout).machines ?? []).filter((m) => m.state === "connected" && !m.temporary).map((m) => m.name);
      } catch {}
      cx.notify();
    });
  }

  close() {
    closeOverlay(props().overlay);
  }

  // The age, memory and sub-agent counts come from the sidebar (spaces-agents publishes them as the
  // shared "sa.snapshot": { info: {terminal: status_ms}, rss: {terminal: kB}, tasks: {terminal: n} }).
  // Without it (the sidebar isn't running) those parts are simply left out.
  rows() {
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
    const groups = spaces().map((w) => {
      const inSpace = all.filter((a) => a.space === w.id);
      const ctxs = w.tabs
        .map((ctx) => {
          const mine = all.filter((a) => a.tab === ctx.id);
          const since = mine.map((a) => snap.info?.[a.address]).filter(Boolean).map((ms) => (now - ms) / 1000);
          const dir = shortDir(ps.find((p) => p.tab === ctx.id && p.terminal)?.cwd);
          return {
            w, ctx, mine, dir,
            team: teamOf(mine.map((a) => a.address)),
            tasks: mine.reduce((n, a) => n + (snap.tasks?.[a.address] ?? 0), 0),
            age: since.length ? Math.min(...since) : null,
            mem: sum(mine.map((a) => snap.rss?.[a.address]).filter((v) => v !== undefined)),
          };
        })
        .map((c) => ({ ...c, label: tabLabel(c.ctx, ps) }))
        .filter((c) => !f || [w.name, w.machine ?? "", c.ctx.name, c.label, c.dir, ...c.mine.map((a) => a.program?.name ?? "")].join(" ").toLowerCase().includes(f));
      return { w, ctxs, agents: inSpace.length, mem: sum(inSpace.map((a) => snap.rss?.[a.address]).filter((v) => v !== undefined)) };
    });
    // This computer first, then each machine; inside one, spaces that need you first.
    const remote = [...new Set(spaces().map((w) => w.machine).filter(Boolean))].sort();
    const grouped = remote.length > 0;
    const byMachine = (list) => [null, ...remote].flatMap((m) =>
      list.filter((p) => (p.w.machine ?? null) === m).sort((a, b) => (b.w.status === "blocked") - (a.w.status === "blocked")));
    const busy = byMachine(groups.filter((p) => p.w.status && p.ctxs.length));
    const quiet = byMachine(groups.filter((p) => !p.w.status && p.ctxs.length));
    const out = [];
    let cur;
    const add = (p) => {
      const m = p.w.machine ?? null;
      if (grouped && m !== cur) { cur = m; out.push({ kind: "machine", m }); }
      out.push({ kind: "head", w: p.w, agents: p.agents, mem: p.mem });
      for (const c of p.ctxs) out.push({ kind: "ctx", ...c });
    };
    busy.forEach(add);
    if (quiet.length) {
      out.push({ kind: "earlier", count: quiet.length });
      if (this.showEarlier || f) { cur = undefined; quiet.forEach(add); }
    }
    out.push({ kind: "new" });
    out.push({ kind: "space", machine: null });
    for (const m of this.machines) out.push({ kind: "space", machine: m });
    return out;
  }

  go(r) {
    if (!r) return;
    this.close();
    if (r.kind === "ctx") run("tab.select", { id: r.ctx.id });
    else if (r.kind === "new") run("tab.new");
    else if (r.kind === "space") run("space.new", { machine: r.machine ?? "" });
  }

  // A small round badge like the sidebar's: filled for done / needs-you, an outline check for idle.
  badge(color, filled, glyph, t) {
    return div().w(14).h(14).flex_none().flex().items_center().justify_center().rounded(7)
      .border_1().border_color(color).when(filled, (e) => e.bg(color)).text_size(9).font_semibold()
      .text_color(filled ? (t.chrome ?? "#1b1d25") : color).child(glyph);
  }

  glyph(t, st) {
    if (st === "working") return svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(pal("running")).spin(900);
    if (st === "blocked") return this.badge(pal("need"), true, "!", t);
    if (st === "done") return this.badge(pal("done"), true, "✓", t);
    if (st === "idle") return this.badge(pal("read"), false, "✓", t);
    return div().w(14).flex_none().text_color(t.dim).child("·");
  }

  render() {
    const t = theme();
    const rows = this.rows();
    const pickable = rows.filter((r) => r.kind === "ctx" || r.kind === "new" || r.kind === "space");
    // Opens on where you are.
    if (this.at === null) this.at = Math.max(0, pickable.findIndex((r) => r.kind === "ctx" && r.w.active && r.ctx.active));
    this.at = Math.min(this.at, pickable.length - 1);
    const sel = pickable[this.at];
    // One continuous strip: each row (and the group title before it) at a fixed
    // y. Scrolling moves the strip only as far as it takes to keep the selected
    // row in view, so the arrows can't run the selection off the list.
    const H = { machine: 30, head: 34, earlier: 35, new: 36, ctx: 50, space: 32 };
    const tops = [];
    let y = 0;
    rows.forEach((r) => { tops.push(y); y += H[r.kind] ?? 32; });
    const total = y;
    const LIST_MAX = 640; // the popup (height 0.9 in mod.json) grows with its list up to this
    const height = Math.min(LIST_MAX, this.listHeight ?? LIST_MAX);
    const fixed = total > height;
    const maxScroll = Math.max(0, total - height);
    this.scroll = Math.max(0, Math.min(this.scroll, maxScroll));
    const si = rows.indexOf(sel);
    if (si >= 0) {
      if (tops[si] < this.scroll) this.scroll = tops[si];
      if (tops[si] + (H[sel.kind] ?? 32) > this.scroll + height) this.scroll = tops[si] + (H[sel.kind] ?? 32) - height;
    }
    const place = (el, i) =>
      fixed
        ? el.absolute().left(0).right(0).top(tops[i] - this.scroll).bottom(height - (tops[i] + (H[rows[i].kind] ?? 32) - this.scroll))
        : el;
    const visible = (i) => !fixed || (tops[i] + (H[rows[i].kind] ?? 32) > this.scroll && tops[i] < this.scroll + height);

    const row = (r) => {
      if (r.kind === "machine") {
        return h_flex().px(10).pt(10).pb(2).gap(7).items_center().text_size(11).text_color(t.dim)
          .child(svg(`mods/workspace-chrome/${r.m ? "server" : "monitor"}.svg`).size(13).flex_none())
          .child(r.m ?? "This computer");
      }
      if (r.kind === "head") {
        const stat = [r.agents ? `${r.agents} agent${r.agents > 1 ? "s" : ""}` : "", r.mem ? memLabel(r.mem) : ""].filter(Boolean).join(" · ");
        return h_flex()
          .px(10)
          .pt(10)
          .pb(3)
          .gap(8)
          .items_center()
          .text_size(11)
          .font_semibold()
          .text_color(t.dim)
          .child(div().w(12).flex_none().text_right().font_normal().child(String(r.w.index ?? "")))
          .child(h_flex().size(18).rounded(5).bg(spaceColor(t, r.w)).items_center().justify_center().text_size(10.5).font_bold().text_color("#ffffff").child([...r.w.name][0]?.toUpperCase() ?? "?"))
          .child(div().flex_1().truncate().child(r.w.name))
          .child(div().font_normal().text_color(t.dim).child(stat));
      }
      if (r.kind === "earlier") {
        return h_flex()
          .id("pk-earlier")
          .mt(6)
          .px(10)
          .py(6)
          .border_t(1)
          .border_color(t.border)
          .text_size(12)
          .text_color(t.dim)
          .cursor_pointer()
          .hover((s) => s.text_color(t.foreground))
          .on_click((_e, cx) => {
            this.showEarlier = !this.showEarlier;
            cx.notify();
          })
          .child(`earlier: ${r.count} quiet space${r.count > 1 ? "s" : ""} ${this.showEarlier ? "▴" : "▾"}`);
      }
      const on = r === sel;
      if (r.kind === "new" || r.kind === "space") {
        const label = r.kind === "new" ? "new tab" : r.machine ? `new space on ${r.machine}` : "new space";
        return h_flex()
          .id(r.kind === "new" ? "pk-new" : `pk-space-${r.machine ?? "here"}`)
          .mx(4)
          .when(r.kind === "new", (el) => el.mt(4))
          .px(10)
          .h(32)
          .items_center()
          .rounded(7)
          .gap(8)
          .text_color(t.muted)
          .cursor_pointer()
          .when(on, (el) => el.bg(t.hover))
          .hover((s) => s.bg(t.hover))
          .on_click(() => this.go(r))
          .child(div().w(12).child("+"))
          .child(label);
      }
      const who = r.mine.map((a) => a.program?.name ?? "agent").join(" · ");
      const here = r.w.active && r.ctx.active;
      const subs = r.tasks + r.team;
      const detail = [r.dir, r.mem ? memLabel(r.mem) : "", subs ? `${subs} sub-agent${subs > 1 ? "s" : ""}` : ""].filter(Boolean).join(" · ");
      return h_flex()
        .id(`pk-${r.ctx.id}`)
        .mx(4)
        .px(10)
        .h(48)
        .rounded(7)
        .gap(10)
        .items_center()
        .cursor_pointer()
        .when(on, (el) => el.bg(t.hover))
        .hover((s) => s.bg(t.hover))
        .on_click(() => this.go(r))
        .child(this.glyph(t, r.ctx.status))
        .child(v_flex().flex_1().min_w(0).gap(1)
          .child(h_flex().gap(8).items_center()
            .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).when(here, (d) => d.font_semibold()).child(r.label ?? r.ctx.name))
            .when(r.ctx.status === "blocked", (el) => el.child(div().text_size(11).text_color(t.blocked).child("needs you")))
            .when(r.ctx.status === "done", (el) => el.child(div().text_size(11).text_color(t.done).child("finished")))
            .child(div().flex_none().text_size(11).text_color(t.dim).child(who))
            .when(r.age !== null, (el) => el.child(div().flex_none().w(28).text_right().text_size(11).text_color(t.dim).child(ageLabel(r.age)))))
          .child(div().h(15).truncate().text_size(11).text_color(t.dim).child(detail || " ")));
    };

    return v_flex()
      .id("picker")
      .track_focus(this.handle)
      .w_full()
      .min_h(0)
      .p(18)
      .gap(10)
      .bg(t.popover)
      .text_size(13)
      .on_key_down((e, cx) => {
        const k = e.key;
        if (k === "escape") return this.close();
        if (k === "down") this.at = (this.at + 1) % pickable.length;
        else if (k === "up") this.at = (this.at + pickable.length - 1) % pickable.length;
        else if (k === "d" && e.modifiers.control) {
          if (sel?.kind === "ctx") {
            this.close();
            run("tab.close", { id: sel.ctx.id });
          }
        } else return;
        cx.stop_propagation();
        cx.notify();
      })
      .child(h_flex().items_center().child(div().flex_1().text_size(15).font_semibold().text_color(t.foreground).child("Go to…")).child(div().text_size(11).text_color(t.dim).child("Esc")))
      .child(
        h_flex().h(36).flex_none().px(10).gap(8).items_center().rounded(9).border_1().border_color(t.accent).bg(t.background)
          .child(svg("mods/workspace-chrome/search.svg").size(15).text_color(t.dim))
          .child(Input.new(this.input).flex_1().h_full().text_size(12.8).text_color(t.foreground)),
      )
      .child(
        v_flex()
          .id("pk-list")
          .on_size_change((size, cx) => {
            this.listHeight = size.height / settings().zoom;
            cx.notify();
          })
          .h(Math.min(LIST_MAX, total))
          .min_h(0)
          .mb(6)
          .when(fixed, (el) =>
            el.overflow_hidden().on_scroll_wheel((e, cx) => {
              this.scroll = Math.max(0, Math.min(this.scroll - e.delta.y, maxScroll));
              // The selection follows the wheel, so the next frame doesn't scroll back to it.
              while (this.at < pickable.length - 1 && tops[rows.indexOf(pickable[this.at])] < this.scroll) this.at++;
              while (this.at > 0 && tops[rows.indexOf(pickable[this.at])] + (H[pickable[this.at].kind] ?? 32) > this.scroll + height) this.at--;
              cx.notify();
            }))
          .children(rows.map((r, i) => (visible(i) ? place(row(r), i) : null)).filter(Boolean)),
      );
  }
}

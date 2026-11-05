// Spaces + agents in one list, cmux style: every space is a numbered row and its agents
// hang underneath it, each with its title, how long ago its status last changed, and a
// per-space summary line "⚡<fresh agents> <memory> · 💤<old idle> <memory>".
//
// Memory is the RSS of each agent's whole process tree (the agent plus everything it
// started), from one `ps` per refresh, summed per space and rounded to 50 MB like cmux's
// agent-status-daemon does. RSS counts shared pages in every process, so it is a rough size.
// Refreshes every 60 s and whenever an agent's status changes.

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, agents, panes, terminals, run, hc, exec, theme, settings, shared, nextCommand, openOverlay, readTextFile, watchFolder, appHome } from "herdr";

const REFRESH_MS = 60000;
const GRAY_AFTER_S = 6 * 3600; // an idle agent this old counts as "old idle" (same as cmux)
// One hex per state, (light, dark): copied from cmux-local's agent-status-daemon.py (PALETTE).
//   done    finished and not looked at yet     read   finished and looked at: the same green, quieter
//   running working                            need   waiting on you          old  the same wait after 15 min
const PAL = {
  done: ["#34C759", "#3FCF6E"], read: ["#6FB58A", "#4A9B6B"], running: ["#2F7BF5", "#4C8DFF"],
  need: ["#E8920A", "#F5A524"], old: ["#E6C27A", "#A47220"], error: ["#E5342B", "#FF453A"],
};
const SUB_GRACE_S = 300;       // keep a stopped Claude sub agent listed this long (same as the hook's GRACE)
const WAIT_DIM_AFTER_S = 900;  // a request this old probably got set aside on purpose, so it recedes
const pal = (name) => PAL[name][settings()?.dark === false ? 0 : 1];
const MARK = { ansi6: "#22a99a", ansi3: "#e3814f", ansi4: "#5b8def", ansi5: "#8b7cf6", ansi2: "#3fae6a", ansi1: "#d9649a" };
const PALETTE = ["ansi6", "ansi3", "ansi4", "ansi5", "ansi2", "ansi1"];
const SPIN = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// The agent's logo from Herdr's program table (same as the stock agents list): a one-color
// glyph drawn in `color`, or a picture.
function logo(p, size, color) {
  if (!p?.icon) return div().w(size).h(size).flex_none();
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

// Same buckets as cmux's age_label: exact for 10 minutes, then coarser, two digits at most.
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

function treeRss(kids, rss, root) {
  const seen = new Set(), stack = [root];
  let sum = 0;
  while (stack.length) {
    const pid = stack.pop();
    if (seen.has(pid)) continue;
    seen.add(pid);
    sum += rss.get(pid) ?? 0;
    stack.push(...(kids.get(pid) ?? []));
  }
  return sum;
}

export default class SpacesAgents extends View {
  init(_props, cx) {
    this.info = {};   // terminal address -> { since: ms, pid }
    this.rss = {};    // terminal address -> kB of its process tree
    this.sig = "";
    this.loading = false;
    this.again = false;
    this.recent = []; // most recently shown tabs, newest first: { space, tab }
    this.subs = {};   // terminal -> Claude's own sub agents there: [{ id, name, started(s) }]
    this.subsRaw = "";
    this.trackActive();
    // herdr-subagent-hook (Claude Code SubagentStart/Stop) writes data/subagents.json; reload when it changes.
    this.loadSubs(cx);
    cx.spawn(async (cx) => {
      try {
        for (;;) { await watchFolder(`${appHome()}/data`); this.loadSubs(cx); }
      } catch { /* no watcher: the timer below still refreshes */ }
    });
    cx.timer.every(20000, (cx) => this.loadSubs(cx));
    this.refresh(cx);
    cx.timer.every(REFRESH_MS, (cx) => this.refresh(cx));
    // keys.json "layout:shawn-style": cmd-w -> "spaces-agents.close" lands here.
    // Uses `cx` each turn: after a hot reload the old build's loop ends at its next cx use,
    // so reloads don't leave several loops all answering the same key.
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "close") this.guardedClose();
        else if (c === "last") this.goLast();
        else if (c === "tab9") this.goTab9();
        cx.notify();
      }
    });
  }

  // Remember which tab is shown, so ctrl-tab can go back to the one before it (Herdr has
  // tab.next / tab.prev but no "last tab"). Called on every render, so every switch is seen.
  trackActive() {
    const sp = spaces().find((s) => s.active);
    const tab = sp?.tabs.find((x) => x.active);
    if (!sp || !tab || this.recent[0]?.tab === tab.id) return;
    this.recent = [{ space: sp.id, tab: tab.id }, ...this.recent.filter((r) => r.tab !== tab.id)].slice(0, 30);
  }

  // ctrl-tab: show the tab you were on before this one (across spaces); pressing it again
  // comes back. Tabs that no longer exist are skipped. Nothing recorded yet: next tab.
  goLast() {
    this.trackActive();
    const all = spaces();
    for (const r of this.recent.slice(1)) {
      const sp = all.find((s) => s.id === r.space);
      const tab = sp?.tabs.find((x) => x.id === r.tab);
      if (!tab) continue;
      if (!sp.active) run("space.select", { id: sp.id });
      run("tab.select", { id: tab.id });
      return;
    }
    run("tab.next", {});
  }

  // cmd-9: tab 9 if this space has one, otherwise the rightmost tab (browser-style "last tab").
  // Settled tabs are skipped, as in Herdr's own tab.select index numbering.
  goTab9() {
    const tabs = (spaces().find((s) => s.active)?.tabs ?? []).filter((t) => !t.settled);
    const tab = tabs[Math.min(9, tabs.length) - 1];
    if (tab) run("tab.select", { id: tab.id });
  }

  // cmd-w: close the shown tab, but ask first when an agent lives in it (Herdr only asks
  // for the last tab of a space). The dialog is Herdr's own `confirm` mod; Enter confirms.
  guardedClose() {
    // One key press must open one dialog, even if two listeners ever exist.
    const now = Date.now();
    if (globalThis.__saCloseAt && now - globalThis.__saCloseAt < 700) return;
    globalThis.__saCloseAt = now;
    const space = spaces().find((s) => s.active);
    const tab = space?.tabs.find((x) => x.active);
    if (!tab) return;
    const inTab = agents().filter((a) => a.tab === tab.id);
    if (!inTab.length) { run("tab.close", { id: tab.id }); return; }
    const n = inTab.length;
    openOverlay({
      mod: "confirm", kind: "dialog", width: 440, height: 170,
      props: {
        title: "Close tab?",
        detail: `This will close "${tab.name}" and end ${n === 1 ? "its running agent" : `${n} running agents`}.`,
        command: { name: "tab.close", args: { id: tab.id, confirmed: true } },
      },
    });
  }

  refresh(cx) {
    if (this.loading) { this.again = true; return; }
    this.loading = true;
    cx.spawn(async (cx) => {
      try {
        const local = agents().filter((a) => !a.address.includes("/"));
        const got = await Promise.all(local.map(async (a) => {
          try {
            const r = await hc(["get", a.address]);
            if (r.code !== 0) return null;
            const j = JSON.parse(r.stdout);
            return [a.address, { since: j.status_ms ?? null, pid: j.pid ?? null }];
          } catch { return null; }
        }));
        const info = Object.fromEntries(got.filter(Boolean));
        const kids = new Map(), rss = new Map();
        try {
          const ps = await exec("ps", ["-axo", "pid=,ppid=,rss="]);
          for (const line of ps.stdout.split("\n")) {
            const [pid, ppid, kb] = line.trim().split(/\s+/).map(Number);
            if (!Number.isFinite(pid) || !Number.isFinite(ppid)) continue;
            rss.set(pid, kb || 0);
            if (!kids.has(ppid)) kids.set(ppid, []);
            kids.get(ppid).push(pid);
          }
        } catch { /* ps unreadable: leave memory out rather than guess */ }
        const mem = {};
        for (const [addr, i] of Object.entries(info)) {
          if (i.pid && rss.has(i.pid)) mem[addr] = treeRss(kids, rss, i.pid);
        }
        this.info = info;
        this.rss = mem;
      } finally {
        this.loading = false;
        cx.notify();
        if (this.again) { this.again = false; this.refresh(cx); }
      }
    });
  }

  // The space's logo color: the one the other mods use (shared "space.colors"), else by position.
  avatarColor(t, s) {
    const c = shared("space.colors")?.[s.id] ?? PALETTE[(s.index - 1 + PALETTE.length) % PALETTE.length];
    return c.startsWith("#") ? c : (MARK[c] ?? t[c] ?? t.accent);
  }

  // A small round badge, like cmux's SF Symbols: filled (checkmark.circle.fill,
  // exclamationmark...fill) or an outline (checkmark.circle, pause.circle).
  badge(color, filled, glyph, t) {
    return div().w(14).h(14).flex_none().flex().items_center().justify_center().rounded(7)
      .border_1().border_color(color).when(filled, (e) => e.bg(color)).text_size(9).font_semibold()
      .text_color(filled ? (t.chrome ?? "#1b1d25") : color).child(glyph);
  }

  // The state symbol, same mapping as cmux: working a spinner, needs-you a filled "!", done a
  // filled green check, idle (looked at) an outline check, long-idle an outline pause.
  statusGlyph(a, old, t, ageS = 0) {
    const tone = this.tone(a.status, old, ageS, t);
    if (a.status === "working") return div().w(14).flex_none().text_color(tone).frames(SPIN, 90).child(SPIN[0]);
    if (a.status === "blocked") return this.badge(tone, true, "!", t);
    if (a.status === "error") return this.badge(pal("error"), true, "×", t);
    if (a.status === "done") return this.badge(tone, true, "✓", t);
    return old ? this.badge(t.muted, false, "‖", t) : this.badge(tone, false, "✓", t);
  }

  // The row's color follows the state, like cmux's color(): hue = state and nothing else.
  // Idle is the quieter "read" green; a long-idle agent has no color (the secondary text color).
  tone(status, old, ageS, t) {
    if (old) return t.muted;
    if (status === "working") return pal("running");
    if (status === "blocked") return pal(ageS > WAIT_DIM_AFTER_S ? "old" : "need");
    if (status === "error") return pal("error");
    if (status === "done") return pal("done");
    return pal("read");
  }

  agentRow(a, t, now) {
    const i = this.info[a.address];
    const age = i?.since ? (now - i.since) / 1000 : null;
    const old = a.status === "idle" && age !== null && age > GRAY_AFTER_S;
    const title = a.title && a.title.trim() ? a.title : a.tab_name;
    const tone = this.tone(a.status, old, age ?? 0, t);
    return h_flex().id(`sa-ag-${a.address}`).h(23).flex_none().pl(18).pr(10).gap(6).items_center().rounded(7)
      .cursor_pointer().when(a.focused, (e) => e.bg(t.selected)).hover((s) => s.bg(t.hover))
      .on_click(() => run("agent.focus", { terminal: a.address }))
      .child(logo(a.program, 16, old ? t.dim : t.foreground))
      .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(tone).child(title))
      .child(div().flex_none().text_size(11).text_color(tone).child(age === null ? "" : ageLabel(age)))
      .child(this.statusGlyph(a, old, t, age ?? 0));
  }

  loadSubs(cx) {
    cx.spawn(async (cx) => {
      let text = "";
      try { text = (await readTextFile(`${appHome()}/data/subagents.json`)) ?? ""; } catch { text = ""; }
      // A stopped sub agent is on a timer (it expires in render), so keep reloading while any exist.
      if (text === this.subsRaw && !this.hasStopped) return;
      this.subsRaw = text;
      const out = {};
      let stopped = false;
      try {
        const now = Date.now() / 1000;
        for (const [term, byId] of Object.entries(JSON.parse(text || "{}"))) {
          const list = Object.entries(byId ?? {})
            .filter(([, v]) => v && now - v.started < 3600 && !(v.stopped && now - v.stopped > SUB_GRACE_S))
            .map(([id, v]) => ({ id, name: v.name || "subagent", started: v.started, stopped: v.stopped ?? null }))
            .sort((a, b) => a.started - b.started);
          if (list.length) out[term] = list;
          if (list.some((e) => e.stopped)) stopped = true;
        }
      } catch { /* torn write: keep nothing rather than guess */ }
      this.subs = out;
      this.hasStopped = stopped;
      cx.notify();
    });
  }

  // One of Claude Code's own sub agents (the Task tool's), running inside agent `a`.
  // After its SubagentStop it may only be waiting on a background job of its own, so it stays
  // for SUB_GRACE_S as a faded "waiting" row instead of vanishing while it is still alive.
  taskRow(e, last, a, t, now) {
    const waiting = Boolean(e.stopped);
    return h_flex().id(`sa-task-${e.id}`).h(22).flex_none().pl(18).pr(10).gap(5).items_center().rounded(7)
      .when(waiting, (el) => el.opacity(0.6))
      .child(div().flex_none().text_size(11).text_color(t.dim).child(last ? "└" : "├"))
      .child(logo(a.program, 13, t.dim))
      .child(h_flex().flex_1().min_w(0).gap(5).items_center()
        .child(div().min_w(0).truncate().text_size(12).text_color(waiting ? t.dim : t.muted).child(e.name))
        .when(waiting, (el) => el.child(div().flex_none().text_size(10).text_color(t.dim).child("waiting"))))
      .child(div().flex_none().text_size(11).text_color(t.dim).child(ageLabel(now / 1000 - e.started)))
      .child(waiting ? this.badge(t.muted, false, "…", t) : this.statusGlyph({ status: "working" }, false, t));
  }

  // Live sub-agents of `addr` (terminals an agent started with `hc run`), depth first, each
  // with the tree glyphs in front of it. Same rule as the stock agents list.
  tree(all, addr, lead = []) {
    const kids = all.filter((k) => k.parent === addr && k.state === "live");
    return kids.flatMap((k, i) => {
      const last = i === kids.length - 1;
      return [
        { t: k, lines: [...lead, last ? "└" : "├"] },
        ...this.tree(all, k.address, [...lead, last ? " " : "│"]),
      ];
    });
  }

  subRow(s, t, listed) {
    const k = s.t;
    // A sub-agent without a pane isn't in agents(): its raw word; error counts as blocked, and
    // it is never "done" (it reports to its parent, whose done is the news).
    const raw = listed.get(k.address) ?? (typeof k.status === "string" ? k.status : k.status?.state);
    const st = raw === "error" ? "blocked" : raw === "done" ? "idle" : raw;
    const name = k.name || k.template || k.program?.name || k.address;
    return h_flex().id(`sa-sub-${k.address}`).h(22).flex_none().pl(18).pr(10).gap(5).items_center().rounded(7)
      .cursor_pointer().hover((e) => e.bg(t.hover))
      .on_click(() => run("terminal.peek", { terminal: k.address }))
      .child(div().flex_none().text_size(11).text_color(t.dim).child(s.lines.join("")))
      .child(logo(k.program, 13, t.dim))
      .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(t.muted).child(name))
      .child(this.statusGlyph({ status: st }, false, t));
  }

  // A tab whose only content is a panel (a mod pane): listed by its tab name (or the panel's title),
  // so tabs like the superproject panel don't vanish from the sidebar.
  panelRow(tab, p, t) {
    const label = tab.named && tab.name ? tab.name : (p.title || p.mod || tab.name);
    return h_flex().id(`sa-pn-${tab.id}`).h(23).flex_none().pl(18).pr(10).gap(6).items_center().rounded(7)
      .cursor_pointer().when(tab.active, (e) => e.bg(t.selected)).hover((s) => s.bg(t.hover))
      .on_click(() => run("tab.select", { id: tab.id }))
      .child(div().w(16).flex_none().text_size(11).text_color(t.dim).child("▦"))
      .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(t.muted).child(label));
  }

  // A tab with no agent in it: its first plain terminal, so shells still show up in the list.
  shellRow(tab, p, t) {
    const dir = p.cwd ? p.cwd.replace(/\/+$/, "").split("/").pop() : "";
    const label = tab.named && tab.name ? tab.name : (dir || tab.name);
    return h_flex().id(`sa-sh-${p.pane}`).h(23).flex_none().pl(18).pr(10).gap(6).items_center().rounded(7)
      .cursor_pointer().when(p.focused, (e) => e.bg(t.selected)).hover((s) => s.bg(t.hover))
      .on_click(() => run("pane.focus", { pane: p.pane }))
      .child(p.program?.icon ? logo(p.program, 16, t.dim)
        : div().w(16).flex_none().text_size(11).text_color(t.dim).child(">_"))
      .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(t.muted).child(label));
  }

  summary(list, t, now) {
    const groups = [];
    for (const wantOld of [false, true]) {
      const members = list.filter((a) => {
        const since = this.info[a.address]?.since;
        const old = a.status === "idle" && since && (now - since) / 1000 > GRAY_AFTER_S;
        return Boolean(old) === wantOld;
      });
      if (!members.length) continue;
      const known = members.map((a) => this.rss[a.address]).filter((v) => v !== undefined);
      const mem = known.length ? ` ${memLabel(known.reduce((x, y) => x + y, 0))}` : "";
      // Same two emoji as cmux's agent-status-daemon: a bolt for the fresh agents, a blue "zzz" for the old idle ones.
      const mark = div().text_size(11).child(wantOld ? "💤" : "⚡");
      groups.push(h_flex().gap(3).items_center().child(mark)
        .child(div().text_size(11).text_color(t.muted).child(`${members.length}${mem}`)));
    }
    return h_flex().flex_none().pl(18).pr(10).pb(2).h(17).items_center().justify_end().gap(6)
      .children(groups.flatMap((g, i) => (i ? [div().text_size(11).text_color(t.dim).child("·"), g] : [g])));
  }

  render(cx) {
    const t = theme();
    const list = agents();
    // An agent's status changing is the signal to re-read its timestamps.
    this.trackActive();
    const sig = list.map((a) => `${a.address}:${a.status}`).join(",");
    if (sig !== this.sig) { this.sig = sig; this.refresh(cx); }
    const now = Date.now();
    const ps = panes();
    const all = terminals();
    const listed = new Map(list.map((a) => [a.address, a.status]));
    const bySpace = new Map();
    for (const a of list) {
      if (!bySpace.has(a.space)) bySpace.set(a.space, []);
      bySpace.get(a.space).push(a);
    }
    const rows = [];
    // Machine headers (as the built-in spaces list): shown once any space lives off this computer.
    const allSpaces = spaces();
    const remote = [...new Set(allSpaces.map((s) => s.machine).filter(Boolean))].sort();
    const grouped = remote.length > 0;
    const folded = new Set(JSON.parse(localStorage.getItem("sa.folded") ?? "[]"));
    const ordered = grouped ? [null, ...remote].flatMap((m) => allSpaces.filter((s) => (s.machine ?? null) === m)) : allSpaces;
    let current = undefined;
    for (const s of ordered) {
      const m = s.machine ?? null;
      if (grouped && m !== current) {
        current = m;
        const key = m ?? "local";
        const closed = folded.has(key);
        rows.push(
          h_flex().id(`sa-mh-${key}`).h(28).flex_none().pl(8).pr(6).gap(6).items_center().rounded(8).cursor_pointer()
            .hover((e) => e.bg(t.hover))
            .on_click((_e, cx) => {
              closed ? folded.delete(key) : folded.add(key);
              localStorage.setItem("sa.folded", JSON.stringify([...folded]));
              cx.notify();
            })
            .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(t.dim).child(m ?? "This computer"))
            .child(div().id(`sa-mn-${key}`).w(22).h(22).flex().items_center().justify_center().rounded(6)
              .text_color(t.dim).hover((e) => e.bg(t.raised))
              .on_click((_e, cx) => { cx.stop_propagation(); run("space.new", { machine: m ?? "" }); }).child("+"))
            .child(div().w(12).flex_none().text_size(11).text_color(t.dim).child(closed ? "›" : "⌄")));
      }
      if (grouped && folded.has(m ?? "local")) continue;
      const mine = (bySpace.get(s.id) ?? []).slice().sort((a, b) => a.tab_index - b.tab_index || a.address.localeCompare(b.address));
      rows.push(
        h_flex().id(`sa-sp-${s.id}`).h(28).flex_none().pl(4).pr(10).gap(8).items_center().rounded(8).cursor_pointer()
          .hover((e) => e.bg(t.hover))
          .on_click(() => run("space.select", { id: s.id }))
          .child(div().w(12).flex_none().text_size(11).text_color(t.dim).text_right().child(String(s.index)))
          .child(div().w(20).h(20).flex_none().flex().items_center().justify_center().rounded(6)
            .bg(this.avatarColor(t, s)).text_color("#ffffff").text_size(11).font_semibold()
            .child((s.name || "?").slice(0, 1).toUpperCase()))
          // No highlight box behind the shown space: its name is bright, the others are dimmer.
          .child(div().min_w(0).truncate().font_semibold().text_color(s.active ? t.foreground : t.muted).child(s.name))
          .child(div().flex_1())
          .when(s.status === "blocked" || s.status === "done", (e) => e.child(
            div().flex_none().text_color(t[s.status]).child("●"))));
      // Tab by tab: the tab's agents, or (no agent) its first plain terminal.
      for (const tab of s.tabs ?? []) {
        const here = mine.filter((a) => a.tab === tab.id);
        for (const a of here) {
          rows.push(this.agentRow(a, t, now));
          const tasks = (this.subs[a.address] ?? []).filter((e) => !(e.stopped && now / 1000 - e.stopped > SUB_GRACE_S));
          const kids = this.tree(all, a.address);
          tasks.forEach((e, i) => rows.push(this.taskRow(e, i === tasks.length - 1 && !kids.length, a, t, now)));
          for (const sub of kids) rows.push(this.subRow(sub, t, listed));
        }
        if (here.length || tab.settled) continue;
        const shell = ps.find((p) => p.tab === tab.id && p.terminal && !p.program?.agent);
        if (shell) { rows.push(this.shellRow(tab, shell, t)); continue; }
        // A tab that holds only a panel (the superproject panel, a markdown viewer...), no terminal.
        const panel = ps.find((p) => p.tab === tab.id && !p.terminal);
        if (panel) rows.push(this.panelRow(tab, panel, t));
      }
      if (mine.length) rows.push(this.summary(mine, t, now));
    }
    return v_flex().id("spaces-agents").size_full().min_h(0).bg(t.chrome).text_color(t.foreground).text_size(13)
      .child(h_flex().h(34).flex_none().px(10).items_center()
        .child(div().flex_1().text_size(11).font_semibold().text_color(t.muted).child("Spaces"))
        .child(div().id("sa-new").w(22).h(22).flex().items_center().justify_center().rounded(6)
          .cursor_pointer().text_color(t.muted).hover((e) => e.bg(t.raised))
          .on_click(() => run("space.new", {})).child("+")))
      .child(v_flex().id("sa-list").flex_1().min_h(0).overflow_y_scrollbar().px(4).pb(8).gap(1).children(rows));
  }
}

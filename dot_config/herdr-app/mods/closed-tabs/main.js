// Closed tabs: recently closed tabs, newest first. Type to filter, ↑/↓ and Enter to
// re-create one (same space, name and folder; a Claude Code tab resumes with
// `claude --continue`), Esc to leave. The history is written by herdr-tab-recorder
// (a launchd job) to <app home>/data/closed-tabs.jsonl and kept for 48 hours; the
// restore itself is done by `herdr-tab-recorder restore`, so the logic lives in one place.

import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { exec, readTextFile, appHome, home, theme, props, closeOverlay } from "herdr";

const TTL_MS = 48 * 3600 * 1000;
const MAX_ROWS = 100;

function ago(ms) {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const shortPath = (p) => (p ? p.replace(home(), "~") : "");

export default class ClosedTabs extends View {
  init(_props, cx) {
    this.entries = [];
    this.filter = "";
    this.at = 0;
    this.note = null;
    this.busy = false;
    this.loaded = false;
    this.handle = cx.focus_handle();
    this.input = InputState.new({ placeholder: "Filter closed tabs…" });
    this.input.on("change", (_e, cx) => { this.filter = this.input.value().toLowerCase(); this.at = 0; cx.notify(); });
    this.input.on("submit", (_e, cx) => this.restore(this.visible()[this.at], cx));
    this.input.focus();
    cx.timer.after(600, () => this.input.focus());
    this.load(cx);
    cx.timer.every(3000, (cx) => this.load(cx));
  }

  load(cx) {
    cx.spawn(async (cx) => {
      let text = "";
      try { text = (await readTextFile(`${appHome()}/data/closed-tabs.jsonl`)) ?? ""; } catch { text = ""; }
      const now = Date.now();
      const entries = [];
      for (const line of text.split("\n")) {
        if (!line.trim()) continue;
        try {
          const e = JSON.parse(line);
          const at = e.closed_at * 1000;
          if (now - at <= TTL_MS) entries.push({ ...e, at, key: `${Math.floor(e.closed_at)}:${e.tab_id}` });
        } catch { /* skip a torn line */ }
      }
      entries.sort((a, b) => b.at - a.at);
      this.entries = entries.slice(0, MAX_ROWS);
      this.loaded = true;
      cx.notify();
    });
  }

  visible() {
    if (!this.filter) return this.entries;
    return this.entries.filter((e) => {
      const t = e.terminals?.[0] ?? {};
      return `${e.tab} ${e.space} ${t.app ?? ""} ${t.cwd ?? ""}`.toLowerCase().includes(this.filter);
    });
  }

  close() {
    const id = props()?.overlay;
    if (id) closeOverlay(id);
  }

  restore(entry, cx) {
    if (!entry || this.busy) return;
    this.busy = true; this.note = null; cx.notify();
    cx.spawn(async (cx) => {
      try {
        const r = await exec(`${home()}/.local/bin/herdr-tab-recorder`, ["restore", entry.key]);
        if (r.code === 0) { this.busy = false; this.close(); this.load(cx); return; }
        this.note = (r.stderr || r.stdout || "restore failed").trim();
      } catch (e) {
        this.note = String(e);
      }
      this.busy = false;
      this.load(cx);
      cx.notify();
    });
  }

  row(e, i, t, cx) {
    const first = e.terminals?.[0] ?? {};
    const more = (e.terminals?.length ?? 1) - 1;
    const selected = i === this.at;
    const agent = first.app && first.app !== "zsh" && first.app !== "bash" ? first.app : null;
    return h_flex().id(`ct-${e.key}`).h(44).flex_none().px(12).gap(10).items_center().rounded(8).cursor_pointer()
      .when(selected, (el) => el.bg(t.selected)).hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => this.restore(e, cx))
      .child(v_flex().flex_1().min_w(0).gap(1)
        .child(h_flex().gap(8).items_center()
          .child(div().font_semibold().truncate().child(e.tab && !/^\d+$/.test(e.tab) ? e.tab : `(tab ${e.tab})`))
          .child(div().text_size(11).text_color(t.dim).child(e.space))
          .when(Boolean(agent), (el) => el.child(div().px(5).rounded(4).text_size(10).border_1().border_color(t.border).text_color(t.muted).child(agent === "claude-code" ? "claude --continue" : agent)))
          .when(more > 0, (el) => el.child(div().text_size(10).text_color(t.dim).child(`+${more} terminal${more > 1 ? "s" : ""} not restored`))))
        .child(div().text_size(11).text_color(t.dim).truncate().child(shortPath(first.cwd))))
      .child(div().flex_none().text_size(11).text_color(t.muted).child(ago(e.at)));
  }

  render(cx) {
    const t = theme();
    const rows = this.visible();
    if (this.at >= rows.length) this.at = Math.max(0, rows.length - 1);
    // A popup is sized by its content, so the list gets an explicit height instead of flex_1.
    const listH = rows.length ? Math.min(rows.length * 46, 380) : 48;
    return v_flex().id("closed-tabs").track_focus(this.handle).w_full().p(18).gap(10)
      .bg(t.popover).text_color(t.foreground).text_size(13)
      .on_key_down((e, cx) => {
        const k = e.key;
        if (k === "escape") return this.close();
        if (k === "down" && rows.length) this.at = (this.at + 1) % rows.length;
        else if (k === "up" && rows.length) this.at = (this.at + rows.length - 1) % rows.length;
        else return;
        cx.stop_propagation();
        cx.notify();
      })
      .child(h_flex().items_center()
        .child(div().flex_1().text_size(15).font_semibold().child("Reopen closed tab"))
        .child(div().text_size(11).text_color(t.dim).child("last 48h · Enter · Esc")))
      .child(h_flex().h(36).flex_none().px(10).items_center().rounded(9).border_1().border_color(t.accent).bg(t.background)
        .child(Input.new(this.input).flex_1().h_full().text_size(12.8).text_color(t.foreground)))
      .when(Boolean(this.note), (el) => el.child(div().text_size(11).text_color(t.ansi1).child(this.note)))
      .child(v_flex().id("ct-list").flex_none().h(listH).overflow_y_scrollbar().gap(2)
        .when(rows.length === 0, (el) => el.child(div().p(12).text_color(t.dim)
          .child(!this.loaded ? "Loading…" : this.filter ? "No match" : "No closed tabs in the last 48 hours")))
        .children(rows.map((e, i) => this.row(e, i, t, cx))));
  }
}

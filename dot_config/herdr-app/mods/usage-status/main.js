// Usage + Claude status, shown once in the bottom bar instead of in every session's status line.
//
// 5h / weekly usage: ~/.cache/claude-rate-limits.json, which this mod only READS. Something has to write it from
//   the `rate_limits` Claude Code puts in the status line JSON (account-wide, live). Without that file the usage
//   part stays hidden. One way: a ccstatusline `custom-command` item with an empty output (so nothing shows) and
//       f="$HOME/.cache/claude-rate-limits.json"; jq -ec 'select(.rate_limits != null) | {rate_limits, ts: (now|floor)}' > "$f.$$" 2>/dev/null && mv "$f.$$" "$f" || rm -f "$f.$$"
//   The file is only rewritten while some Claude Code session is drawing its status line, so the age of the data
//   is always shown and goes yellow when it is old.
// Claude status: status.claude.com summary, component "Claude Code". Shown only when NOT operational.
//   A notification is posted only when that status changes (the last one is kept in localStorage, so a
//   hot reload or restart does not repeat it).

import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme, notify, home, readTextFile } from "herdr";

const USAGE_FILE = `${home()}/.cache/claude-rate-limits.json`;
const USAGE_EVERY_MS = 30_000;
const STATUS_EVERY_MS = 60_000;
const STALE_MS = 30 * 60_000;
const STATUS_URL = "https://status.claude.com/api/v2/summary.json";
const COMPONENT = "Claude Code";
const LEVEL = { degraded_performance: "warning", under_maintenance: "info", partial_outage: "error", major_outage: "error" };

const minutes = (ms) => Math.max(0, Math.floor(ms / 60_000));
function span(ms) {
  const m = minutes(ms);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}
const pretty = (s) => String(s).replace(/_/g, " ");

export default class UsageStatus extends View {
  init(_props, cx) {
    this.usage = null;          // { session, sessionReset, weekly, weeklyReset, mtime }
    this.status = localStorage.getItem("lastStatus");   // last status we told the person about
    this.now = Date.now();
    this.lastKey = "";
    this.loadUsage(cx);
    this.loadStatus(cx);
    cx.timer.every(USAGE_EVERY_MS, (cx) => this.loadUsage(cx));
    cx.timer.every(STATUS_EVERY_MS, (cx) => this.loadStatus(cx));
  }

  loadUsage(cx) {
    cx.spawn(async (cx) => {
      try {
        const j = JSON.parse(await readTextFile(USAGE_FILE));
        const five = j.rate_limits?.five_hour, week = j.rate_limits?.seven_day;
        this.usage = {
          session: Math.round(five.used_percentage), sessionReset: five.resets_at * 1000,
          weekly: Math.round(week.used_percentage), weeklyReset: week.resets_at * 1000,
          mtime: j.ts * 1000,
        };
      } catch { this.usage = null; }
      this.touch(cx);
    });
  }

  loadStatus(cx) {
    cx.spawn(async (cx) => {
      let s = null;
      try {
        const res = await fetch(STATUS_URL);
        const j = await res.json();
        s = j.components?.find((c) => c.name === COMPONENT)?.status ?? null;
      } catch { return; }          // offline or bad reply: say nothing, keep the last known state
      if (!s) return;
      const prev = this.status;
      this.liveStatus = s;
      if (prev !== s) {
        this.status = s;
        localStorage.setItem("lastStatus", s);
        if (!(prev == null && s === "operational")) {     // first ever run, healthy: just a baseline
          if (s === "operational") notify({ title: "Claude Code is operational again", level: "success", timeout: 8000 });
          else notify({ title: `Claude Code: ${pretty(s)}`, body: "status.claude.com", level: LEVEL[s] ?? "warning", timeout: 15000 });
        }
      }
      this.touch(cx);
    });
  }

  // What is on screen, as plain data, so a redraw happens only when it would look different.
  parts() {
    const now = Date.now();
    const u = this.usage;
    const out = [];
    if (u) {
      const win = (label, pct, reset) => {
        const left = reset - now;
        out.push({ text: `${label} ${pct}%`, tone: pct >= 90 ? "bad" : pct >= 75 ? "warn" : "norm" });
        // reset time already passed: the percentage belongs to the previous window
        out.push({ text: left > 0 ? `↻${span(left)}` : "↻?", tone: left > 0 ? "dim" : "warn" });
      };
      win("5h", u.session, u.sessionReset);
      win("wk", u.weekly, u.weeklyReset);
      const age = now - u.mtime;
      out.push({ text: age > STALE_MS ? `stale ${span(age)}` : `${minutes(age)}m ago`, tone: age > STALE_MS ? "warn" : "dim" });
    }   // no data file (nothing writes it here, or it was removed): show no usage at all
    const s = this.liveStatus;
    if (s && s !== "operational") out.push({ text: `⚠ ${COMPONENT}: ${pretty(s)}`, tone: s === "degraded_performance" ? "warn" : "bad" });
    return out;
  }

  touch(cx) {
    const key = JSON.stringify(this.parts());
    if (key !== this.lastKey) { this.lastKey = key; cx.notify(); }
  }

  render(cx) {
    const t = theme();
    const color = { norm: t.foreground, dim: t.dim, warn: t.ansi3, bad: t.ansi1 };
    return h_flex().size_full().px(14).gap(10).items_center().justify_end().bg(t.chrome).border_t(1).border_color(t.border)
      .text_size(11.8).text_color(t.muted)
      .children(this.parts().map((p) => div().flex_none().text_color(color[p.tone]).child(p.text)));
  }
}

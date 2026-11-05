import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, theme, agents } from "herdr";

// Superproject panel: one row per repo, grouped by `wsg` groups.
// Data comes from `wsg status --json @<group>` (the single source of truth for
// the git logic). Props: { root?: string, groups?: string[] }.
const DEFAULT_ROOT = "/Users/shdennlin/workspace/onelegion";
const DEFAULT_GROUPS = ["basic", "service", "exploit", "other"];
const REFRESH_MS = 30000;

export default class Superproject extends View {
  init(props, cx) {
    this.root = props?.root ?? DEFAULT_ROOT;
    this.groups = props?.groups ?? DEFAULT_GROUPS;
    this.data = {};          // group -> { repos } | { error }
    this.updated = null;
    this.loading = false;
    this.prevWorking = undefined;
    this.refresh(cx);
    cx.timer.every(REFRESH_MS, (cx) => this.refresh(cx));
  }

  refresh(cx) {
    if (this.loading) return;
    this.loading = true;
    cx.spawn(async (cx) => {
      try {
        const results = await Promise.all(this.groups.map((g) => this.load(g)));
        this.groups.forEach((g, i) => { this.data[g] = results[i]; });
        this.updated = new Date();
      } finally {
        this.loading = false;
        cx.notify();
      }
    });
  }

  // `.envrc` in the root defines the groups (WSG_GROUPS_RAW), so run under direnv.
  async load(group) {
    if (!/^[A-Za-z0-9_-]+$/.test(group)) return { error: `bad group name: ${group}` };
    try {
      // WSG_NO_LOG=1: don't count panel refreshes in wsg's usage log.
      const script = `export WSG_NO_LOG=1; source "$HOME/.zsh/wsg.zsh"; wsg status --json @${group}`;
      const r = await exec("direnv", ["exec", ".", "zsh", "-fc", script], { cwd: this.root });
      if (r.code !== 0) {
        const lines = (r.stderr || r.stdout).trim().split("\n");
        return { error: lines[lines.length - 1] || `exit ${r.code}` };
      }
      return { repos: JSON.parse(r.stdout).repos };
    } catch (e) {
      return { error: String(e) };
    }
  }

  openInEditor(path, cx) {
    cx.spawn(async () => { await exec("open", ["-a", "Visual Studio Code", path]); });
  }

  cell(width, child) {
    return div().w(width).flex_none().min_w(0).truncate().child(child);
  }

  repoRow(group, repo, t) {
    const id = `sp-${group}-${repo.name}`;
    if (repo.error) {
      return h_flex().id(id).h(26).flex_none().px(8).gap(8).items_center()
        .child(this.cell(130, repo.name))
        .child(div().text_color(t.ansi1).child(repo.error));
    }
    const sync = repo.ahead === null
      ? div().text_color(t.dim).child("no upstream")
      : h_flex().gap(6)
        .child(div().text_color(repo.ahead > 0 ? t.ansi6 : t.dim).child(`↑${repo.ahead}`))
        .child(div().text_color(repo.behind > 0 ? t.ansi1 : t.dim).child(`↓${repo.behind}`));
    const lines = h_flex().gap(6)
      .child(div().text_color(repo.added > 0 ? t.ansi2 : t.dim).child(`+${repo.added}`))
      .child(div().text_color(repo.deleted > 0 ? t.ansi1 : t.dim).child(`−${repo.deleted}`));
    const flags = `${repo.staged ? "+" : ""}${repo.modified ? "*" : ""}${repo.untracked ? "?" : ""}`;
    // develop is always far ahead of main; only show the comparison on other branches.
    const vs = repo.vs_default && repo.branch !== "develop"
      ? `${repo.vs_default.branch} ↑${repo.vs_default.ahead}↓${repo.vs_default.behind}` : "";
    const stale = (repo.stale ?? []).map((s) =>
      s.state === "moved" ? s.path : `${s.path} (${s.state})`);
    const row = h_flex().id(id).h(26).flex_none().px(8).gap(8).items_center().rounded(6)
      .hover((s) => s.bg(t.hover))
      .child(div().w(14).flex_none().text_color(repo.dirty ? t.ansi3 : t.ansi2).child(repo.dirty ? "●" : "○"))
      .child(this.cell(120, repo.name))
      .child(this.cell(200, div().text_color(repo.detached ? t.ansi3 : t.ansi2).child(`⎇ ${repo.branch}`)))
      .child(this.cell(84, sync))
      .child(this.cell(80, lines))
      .child(div().flex_1().min_w(0).truncate().text_color(t.ansi3).child(flags))
      .child(div().id(`${id}-open`).flex_none().w(22).h(22).flex().items_center().justify_center().rounded(5)
        .cursor_pointer().text_color(t.muted).hover((s) => s.bg(t.raised))
        .on_click((_e, cx) => { cx.stop_propagation(); this.openInEditor(repo.path, cx); })
        .child("↗"));
    // Secondary info goes on its own line so a narrow pane never clips it.
    if (!vs && stale.length === 0) return row;
    return v_flex().flex_none().child(row)
      .child(h_flex().pl(30).pb(4).gap(10).text_size(11)
        .when(Boolean(vs), (e) => e.child(div().text_color(t.dim).child(`vs ${vs}`)))
        .when(stale.length > 0, (e) => e.child(div().text_color(t.ansi1).child(`⚙ stale: ${stale.join(", ")}`))));
  }

  render(cx) {
    const t = theme();
    // Refresh when an agent finishes a turn (working count drops); no polling of Git beyond the timer.
    const working = agents().filter((a) => a.status === "working").length;
    if (this.prevWorking !== undefined && working < this.prevWorking) this.refresh(cx);
    this.prevWorking = working;

    const seen = new Map();
    for (const g of this.groups) for (const r of this.data[g]?.repos ?? []) seen.set(r.path, r);
    const all = [...seen.values()];
    const dirty = all.filter((r) => r.dirty).length;
    const behind = all.filter((r) => r.behind > 0).length;
    const stale = all.reduce((n, r) => n + (r.stale?.length ?? 0), 0);
    const time = this.updated ? this.updated.toLocaleTimeString() : "…";

    return v_flex().id("superproject").size_full().min_h(0).rounded(10).overflow_hidden()
      .bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13)
      .child(h_flex().h(42).flex_none().px(14).gap(10).items_center().border_b(1).border_color(t.border)
        .child(div().font_semibold().child("Superproject"))
        .child(div().text_color(t.dim).child(this.root.split("/").pop()))
        .child(div().flex_1())
        .child(div().text_size(11).text_color(t.muted)
          .child(`${all.length} repos · ${dirty} dirty · ${behind} behind · ${stale} stale`))
        .child(div().id("sp-refresh").h(26).px(10).flex().items_center().rounded(6).border_1().border_color(t.border)
          .cursor_pointer().hover((s) => s.bg(t.hover)).text_size(12)
          .on_click((_e, cx) => this.refresh(cx))
          .child(this.loading ? "Refreshing…" : `Refresh · ${time}`)))
      .child(v_flex().id("sp-list").flex_1().min_h(0).overflow_y_scrollbar().p(8).gap(10)
        .children(this.groups.map((g) => {
          const d = this.data[g];
          const repos = d?.repos ?? [];
          return v_flex().gap(2)
            .child(h_flex().px(8).h(22).gap(8).items_center()
              .child(div().text_size(11).font_semibold().text_color(t.muted).child(`@${g}`))
              .child(div().text_size(11).text_color(t.dim)
                .child(d?.error ? "error" : `${repos.length} repos · ${repos.filter((r) => r.dirty).length} dirty`)))
            .when(Boolean(d?.error), (e) => e.child(div().px(8).text_color(t.ansi1).child(d.error)))
            .when(!d, (e) => e.child(div().px(8).text_color(t.dim).child("Loading…")))
            .children(repos.map((r) => this.repoRow(g, r, t)));
        })));
  }
}

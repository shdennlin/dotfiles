import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, theme, panes, spaces, settings } from "herdr";

// Superproject panel: one row per repo, grouped by `wsg` groups.
// It updates when it is brought into view (first open, or its tab gets selected) and when you press
// Refresh. There is no timer and no polling: Git state only matters while someone is looking at it.
// Data comes from `wsg status --json @<group>` (the single source of truth for
// the git logic). Props: { root?: string, groups?: string[] }.
const DEFAULT_ROOT = "/Users/shdennlin/workspace/onelegion";
const DEFAULT_GROUPS = ["basic", "service", "exploit", "other"];
const MIN_GAP_MS = 3000;   // switching away and straight back does not refresh twice
// Panel size: every pixel size below goes through z(). Z follows the terminal font size (settings().font_size,
// 16 px at zoom 1 here; the app multiplies both the terminal and mod text by zoom, so they match on screen):
// Z = font_size / 13, which makes the panel text exactly as big as the terminal text and scales rows/columns with it.
let Z = 1.2;
const z = (n) => Math.round(n * Z * 2) / 2;
const TEXT = 13;   // the one text size for the whole panel, before z(): z(TEXT) == the terminal font size

export default class Superproject extends View {
  init(props, cx) {
    this.root = props?.root ?? DEFAULT_ROOT;
    this.groups = props?.groups ?? DEFAULT_GROUPS;
    this.data = {};          // group -> { repos } | { error }
    this.updated = null;
    this.loading = false;
    this.wasShown = false;
    this.refresh(cx);
    // A hidden mod is not redrawn, so render() alone can never see "hidden -> shown". This only reads
    // the in-memory tab state once a second (no git, no redraw) and refreshes on that transition.
    cx.timer.every(1000, (cx) => this.checkFocus(cx));
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

  // Update when this panel comes into view: its pane is in the shown tab now and was not before.
  checkFocus(cx) {
    const activeTab = spaces().find((s) => s.active)?.tabs.find((x) => x.active)?.id;
    const shown = panes().some((p) => p.mod === "superproject" && p.tab === activeTab);
    if (shown && !this.wasShown && (!this.updated || Date.now() - this.updated.getTime() > MIN_GAP_MS)) this.refresh(cx);
    this.wasShown = shown;
  }

  openInEditor(path, cx) {
    cx.spawn(async () => { await exec("open", ["-a", "Visual Studio Code", path]); });
  }

  cell(width, child) {
    return div().w(width).flex_none().min_w(0).truncate().child(child);
  }

  repoRow(group, repo, t) {
    // A linked worktree (`git worktree add`, where AI agents often work) sits under its repo, indented.
    // Keyed by path: a worktree can have the same folder name as its repo (openspec's does).
    const wt = repo.worktree;
    const id = `sp-${group}-${repo.path}`;
    // ".worktrees/" is the same prefix on nearly all of them and would push the part that tells them apart off the cell.
    const title = wt ? `↳ ${wt.label.replace(/^\.worktrees\//, "")}` : repo.name;
    const wtFlags = wt ? ["locked", "prunable"].filter((k) => wt[k]).join(" · ") : "";
    if (repo.error) {
      return h_flex().id(id).h(z(22)).flex_none().pl(z(wt ? 22 : 8)).pr(z(8)).gap(z(8)).items_center().text_size(z(TEXT))
        .child(this.cell(z(wt ? 240 : 130), title))
        .child(div().text_color(t.ansi1).child(repo.error))
        .when(Boolean(wtFlags), (e) => e.child(div().text_size(z(TEXT)).text_color(t.ansi3).child(wtFlags)));
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
    const row = h_flex().id(id).h(z(22)).flex_none().pl(z(wt ? 22 : 8)).pr(z(8)).gap(z(8)).items_center().rounded(6).text_size(z(TEXT))
      .hover((s) => s.bg(t.hover))
      .child(div().w(z(14)).flex_none().text_color(repo.dirty ? t.ansi3 : t.ansi2).child(repo.dirty ? "●" : "○"))
      .child(this.cell(z(wt ? 106 : 120), wt ? div().text_size(z(TEXT)).text_color(t.muted).child(title) : repo.name))
      .child(this.cell(z(200), div().text_color(repo.detached ? t.ansi3 : t.ansi2).child(`⎇ ${repo.branch}`)))
      .child(this.cell(z(84), sync))
      .child(this.cell(z(80), lines))
      .child(div().flex_1().min_w(0).truncate().text_color(t.ansi3).child(flags))
      .child(div().id(`${id}-open`).flex_none().w(z(22)).h(z(22)).flex().items_center().justify_center().rounded(5)
        .cursor_pointer().text_color(t.muted).hover((s) => s.bg(t.raised))
        // Always the superproject root, not this repo's folder: VS Code focuses the window that already
        // has the root open (no extra window per repo), and its Git Graph repo picker covers every submodule.
        .on_click((_e, cx) => { cx.stop_propagation(); this.openInEditor(this.root, cx); })
        .child("↗"));
    // Secondary info goes on its own line so a narrow pane never clips it.
    if (!vs && stale.length === 0 && !wtFlags) return row;
    return v_flex().flex_none().child(row)
      .child(h_flex().pl(z(wt ? 44 : 30)).pb(z(2)).gap(z(10)).text_size(z(TEXT))
        .when(Boolean(wtFlags), (e) => e.child(div().text_color(t.ansi3).child(wtFlags)))
        .when(Boolean(vs), (e) => e.child(div().text_color(t.dim).child(`vs ${vs}`)))
        .when(stale.length > 0, (e) => e.child(div().text_color(t.ansi1).child(`⚙ stale: ${stale.join(", ")}`))));
  }

  render(cx) {
    const t = theme();
    Z = (Number(settings()?.font_size) || 13) / 13;   // follow the terminal font size (changes apply on the next redraw)
    this.checkFocus(cx);

    const seen = new Map();
    for (const g of this.groups) for (const r of this.data[g]?.repos ?? []) seen.set(r.path, r);
    const all = [...seen.values()];
    const dirty = all.filter((r) => r.dirty).length;
    const behind = all.filter((r) => r.behind > 0).length;
    const stale = all.reduce((n, r) => n + (r.stale?.length ?? 0), 0);
    const time = this.updated ? this.updated.toLocaleTimeString() : "…";

    return v_flex().id("superproject").size_full().min_h(0).rounded(10).overflow_hidden()
      .bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(z(TEXT))
      .child(h_flex().h(z(42)).flex_none().px(z(14)).gap(z(10)).items_center().border_b(1).border_color(t.border)
        .child(div().font_semibold().child("Superproject"))
        .child(div().text_color(t.dim).child(this.root.split("/").pop()))
        .child(div().flex_1())
        .child(div().text_size(z(TEXT)).text_color(t.muted)
          .child(`${all.filter((r) => !r.worktree).length} repos · ${all.filter((r) => r.worktree).length} worktrees · ${dirty} dirty · ${behind} behind · ${stale} stale`))
        .child(div().id("sp-refresh").h(z(26)).px(z(10)).flex().items_center().rounded(6).border_1().border_color(t.border)
          .cursor_pointer().hover((s) => s.bg(t.hover)).text_size(z(TEXT))
          .on_click((_e, cx) => this.refresh(cx))
          .child(this.loading ? "Refreshing…" : `Refresh · ${time}`)))
      .child(v_flex().id("sp-list").flex_1().min_h(0).overflow_y_scrollbar().p(z(8)).gap(z(6))
        .children(this.groups.map((g) => {
          const d = this.data[g];
          const repos = d?.repos ?? [];
          return v_flex().gap(0)
            .child(h_flex().px(z(8)).h(z(20)).gap(z(8)).items_center()
              .child(div().text_size(z(TEXT)).font_semibold().text_color(t.muted).child(`@${g}`))
              .child(div().text_size(z(TEXT)).text_color(t.dim)
                .child(d?.error ? "error" : `${repos.filter((r) => !r.worktree).length} repos`
                  + (repos.some((r) => r.worktree) ? ` + ${repos.filter((r) => r.worktree).length} worktrees` : "")
                  + ` · ${repos.filter((r) => r.dirty).length} dirty`)))
            .when(Boolean(d?.error), (e) => e.child(div().px(8).text_color(t.ansi1).child(d.error)))
            .when(!d, (e) => e.child(div().px(8).text_color(t.dim).child("Loading…")))
            .children(repos.map((r) => this.repoRow(g, r, t)));
        })));
  }
}

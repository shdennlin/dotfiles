import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, theme, panes, spaces, settings } from "herdr";

// Superproject panel: one row per repo, grouped by `wsg` groups.
// It updates when it is brought into view (first open, or its tab gets selected) and when you press
// Refresh. There is no timer and no polling: Git state only matters while someone is looking at it.
// Data comes from `wsg status --json @<group>` (the single source of truth for
// the git logic). Props: { root?: string, groups?: string[] }.
const DEFAULT_ROOT = "<redacted-root>";
const DEFAULT_GROUPS = ["basic", "service", "exploit", "other"];
const MIN_GAP_MS = 3000;   // switching away and straight back does not refresh twice
const PR_LIMIT = 3;        // open PRs shown per repo
// Panel size: every pixel size below goes through z(). Z follows the terminal font size (settings().font_size,
// 16 px at zoom 1 here; the app multiplies both the terminal and mod text by zoom, so they match on screen):
// Z = font_size / 13, which makes the panel text exactly as big as the terminal text and scales rows/columns with it.
let Z = 1.2;
const z = (n) => Math.round(n * Z * 2) / 2;
const TEXT = 13;   // the one text size for the whole panel, before z(): z(TEXT) == the terminal font size
// Column layout shared by the data rows and the header row (before z()), so they cannot drift apart.
// A worktree row is indented by WT_INDENT and its name cell shrinks by the same amount, so every column
// after the name lines up with the main repos.
const COL = { dot: 12, name: 104, branch: 230, sync: 84, vs: 104, lines: 64, open: 22 };
const ROW_PAD = 8, ROW_GAP = 7, WT_INDENT = 12, LIST_PAD = 6;

export default class Superproject extends View {
  init(props, cx) {
    this.root = props?.root ?? DEFAULT_ROOT;
    this.groups = props?.groups ?? DEFAULT_GROUPS;
    this.data = {};          // group -> { repos } | { error }
    this.prs = {};           // repo path -> [{ number, title, url, isDraft }] (open PRs, up to PR_LIMIT)
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
      // PRs come after the git rows are drawn, so a slow `gh` never delays the repo list.
      await this.loadPrs(cx);
    });
  }

  // Open PRs for each main checkout (worktrees share their repo's PRs, so they are skipped).
  async loadPrs(cx) {
    const seen = new Map();
    for (const g of this.groups) for (const r of this.data[g]?.repos ?? []) {
      if (!r.error && !r.worktree) seen.set(r.path, r);
    }
    const repos = [...seen.values()];
    const results = await Promise.all(repos.map((r) => this.loadPr(r)));
    repos.forEach((r, i) => { this.prs[r.path] = results[i]; });
    cx.notify();
  }

  // `gh` fails in a repo with no GitHub remote; that just means no PRs to show, so it is not an error row.
  async loadPr(repo) {
    try {
      const r = await exec("gh", ["pr", "list", "--state", "open", "--limit", String(PR_LIMIT),
        "--json", "number,title,url,isDraft"], { cwd: repo.path });
      if (r.code !== 0) return [];
      return JSON.parse(r.stdout).slice(0, PR_LIMIT);
    } catch (e) {
      return [];
    }
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

  openUrl(url, cx) {
    cx.spawn(async () => { await exec("open", [url]); });
  }

  // One indented line per open PR, under its repo row. Clicking opens the PR page in the browser.
  prRows(repo, t) {
    const prs = this.prs[repo.path] ?? [];
    if (repo.error || prs.length === 0) return null;
    return v_flex().flex_none().children(prs.map((pr) =>
      h_flex().id(`sp-pr-${repo.path}-${pr.number}`).h(z(20)).flex_none().pl(z(ROW_PAD + 28)).pr(z(ROW_PAD)).gap(z(ROW_GAP)).items_center()
        .text_size(z(TEXT)).rounded(5).cursor_pointer().hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => { cx.stop_propagation(); this.openUrl(pr.url, cx); })
        .child(div().flex_none().text_color(pr.isDraft ? t.muted : t.ansi5).child(pr.isDraft ? "◌" : "⑂"))
        .child(div().flex_none().text_color(t.ansi5).child(`#${pr.number}`))
        .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(pr.title))));
  }

  cell(width, child) {
    return div().w(width).flex_none().min_w(0).truncate().child(child);
  }

  // Branch name with the short HEAD hash (from `wsg status --json`, field `sha`) in muted text after it.
  // A detached HEAD has no branch, so it shows "detached @hash" in the warning colour instead.
  branchCell(repo, t) {
    if (repo.detached) return div().text_color(t.ansi3).child(`⎇ detached @${repo.sha ?? "?"}`);
    return h_flex().gap(6).items_center()
      .child(div().text_color(t.ansi2).child(`⎇ ${repo.branch}`))
      .when(Boolean(repo.sha), (e) => e.child(div().text_color(t.muted).child(repo.sha)));
  }

  repoRow(group, repo, t) {
    // A linked worktree (`git worktree add`, where AI agents often work) sits under its repo, indented.
    // Keyed by path: a worktree can have the same folder name as its repo (openspec's does).
    const wt = repo.worktree;
    const id = `sp-${group}-${repo.path}`;
    // ".worktrees/" is the same prefix on nearly all of them and would push the part that tells them apart off the cell.
    const title = wt ? `↳ ${wt.label.split("/").pop()}` : repo.name;
    const wtFlags = wt ? ["locked", "prunable"].filter((k) => wt[k]).join(" · ") : "";
    if (repo.error) {
      return h_flex().id(id).h(z(22)).flex_none().pl(z(ROW_PAD + (wt ? WT_INDENT : 0))).pr(z(ROW_PAD)).gap(z(ROW_GAP)).items_center().text_size(z(TEXT))
        .child(this.cell(z(wt ? 240 : 130), title))
        .child(div().text_color(t.ansi1).child(repo.error))
        .when(Boolean(wtFlags), (e) => e.child(div().text_size(z(TEXT)).text_color(t.ansi3).child(wtFlags)));
    }
    // Zero values are left out (a clean row stays quiet); "·" = in sync, "—" = no upstream.
    const part = (n, sym, color) => n > 0 ? div().text_color(color).child(`${sym}${n}`) : null;
    const pair = (...kids) => {
      const k = kids.filter(Boolean);
      return k.length ? h_flex().gap(6).children(k) : null;
    };
    const sync = repo.ahead === null
      ? div().text_color(t.muted).child("—")
      : pair(part(repo.ahead, "↑", t.ansi6), part(repo.behind, "↓", t.ansi1)) ?? div().text_color(t.muted).child("·");
    const lines = pair(part(repo.added, "+", t.ansi2), part(repo.deleted, "−", t.ansi1)) ?? div();
    const flags = `${repo.staged ? "+" : ""}${repo.modified ? "*" : ""}${repo.untracked ? "?" : ""}`;
    // vs_default is the closest of origin/develop|main|master (picked by wsg), so it is meaningful on every branch.
    const vd = repo.vs_default;
    const vsCell = vd
      ? h_flex().gap(4)
        .child(div().text_color(t.foreground).child(vd.branch))
        .children([part(vd.ahead, "↑", t.ansi6), part(vd.behind, "↓", t.ansi1)].filter(Boolean))
      : div();
    const stale = (repo.stale ?? []).map((s) =>
      s.state === "moved" ? s.path : `${s.path} (${s.state})`);
    const row = h_flex().id(id).h(z(22)).flex_none().pl(z(ROW_PAD + (wt ? WT_INDENT : 0))).pr(z(ROW_PAD)).gap(z(ROW_GAP)).items_center().rounded(6).text_size(z(TEXT))
      .when(Boolean(wt), (e) => e.opacity(0.75))   // linked worktrees: slightly dimmer than the main checkouts
      .hover((s) => s.bg(t.hover))
      .child(div().w(z(COL.dot)).flex_none().text_color(repo.dirty ? t.ansi3 : t.ansi2).child(repo.dirty ? "●" : "○"))
      .child(this.cell(z(COL.name - (wt ? WT_INDENT : 0)), wt ? div().text_size(z(TEXT)).text_color(t.muted).child(title) : repo.name))
      .child(this.cell(z(COL.branch), this.branchCell(repo, t)))
      .child(this.cell(z(COL.sync), sync))
      .child(this.cell(z(COL.vs), vsCell))
      .child(this.cell(z(COL.lines), lines))
      .child(div().flex_1().min_w(0).truncate().text_color(t.ansi3).child(flags))
      .child(div().id(`${id}-open`).flex_none().w(z(COL.open)).h(z(22)).flex().items_center().justify_center().rounded(5)
        .cursor_pointer().text_color(t.muted).hover((s) => s.bg(t.raised))
        // Always the superproject root, not this repo's folder: VS Code focuses the window that already
        // has the root open (no extra window per repo), and its Git Graph repo picker covers every submodule.
        .on_click((_e, cx) => { cx.stop_propagation(); this.openInEditor(this.root, cx); })
        .child("↗"));
    // Secondary info goes on its own line so a narrow pane never clips it.
    if (stale.length === 0 && !wtFlags) return row;
    return v_flex().flex_none().child(row)
      .child(h_flex().pl(z(wt ? 40 : 28)).pb(z(1)).gap(z(10)).text_size(z(TEXT))
        .when(Boolean(wtFlags), (e) => e.child(div().text_color(t.ansi3).child(wtFlags)))
        .when(stale.length > 0, (e) => e.child(div().text_color(t.ansi1).child(`⚙ stale: ${stale.join(", ")}`))));
  }

  // Column names, outside the scrolling list. Same widths/offsets as repoRow(): list padding + row padding on the left,
  // then dot / name / branch / sync / vs / lines, a flexible Flags cell, and a spacer where the ↗ button sits.
  headerRow(t) {
    const h = (width, label) => this.cell(z(width), label);
    return h_flex().h(z(20)).flex_none().pl(z(LIST_PAD + ROW_PAD)).pr(z(LIST_PAD + ROW_PAD)).gap(z(ROW_GAP)).items_center()
      .border_b(1).border_color(t.border).text_size(z(TEXT)).text_color(t.muted)
      .child(div().w(z(COL.dot)).flex_none())
      .child(h(COL.name, "Repo"))
      .child(h(COL.branch, "Branch"))
      .child(h(COL.sync, "Upstream"))
      .child(h(COL.vs, "Base"))
      .child(h(COL.lines, "Changes"))
      .child(div().flex_1().min_w(0).truncate().child("Flags"))
      .child(div().w(z(COL.open)).flex_none());
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
      .child(h_flex().h(z(36)).flex_none().px(z(12)).gap(z(9)).items_center().border_b(1).border_color(t.border)
        .child(div().font_semibold().child("Superproject"))
        .child(div().text_color(t.muted).child(this.root.split("/").pop()))
        .child(div().flex_1())
        .child(div().text_size(z(TEXT)).text_color(t.muted)
          .child(`${all.filter((r) => !r.worktree).length} repos · ${all.filter((r) => r.worktree).length} worktrees · ${dirty} dirty · ${behind} behind · ${stale} stale`))
        .child(div().id("sp-refresh").h(z(24)).px(z(9)).flex().items_center().rounded(6).border_1().border_color(t.border)
          .cursor_pointer().hover((s) => s.bg(t.hover)).text_size(z(TEXT))
          .on_click((_e, cx) => this.refresh(cx))
          .child(this.loading ? "Refreshing…" : `Refresh · ${time}`)))
      .child(this.headerRow(t))
      .child(v_flex().id("sp-list").flex_1().min_h(0).overflow_y_scrollbar().p(z(LIST_PAD)).gap(z(4))
        .children(this.groups.map((g) => {
          const d = this.data[g];
          const repos = d?.repos ?? [];
          return v_flex().gap(0)
            .child(h_flex().px(z(8)).h(z(20)).gap(z(7)).items_center()
              .child(div().text_size(z(TEXT)).font_semibold().text_color(t.muted).child(`@${g}`))
              .child(div().text_size(z(TEXT)).text_color(t.muted)
                .child(d?.error ? "error" : `${repos.filter((r) => !r.worktree).length} repos`
                  + (repos.some((r) => r.worktree) ? ` + ${repos.filter((r) => r.worktree).length} worktrees` : "")
                  + ` · ${repos.filter((r) => r.dirty).length} dirty`)))
            .when(Boolean(d?.error), (e) => e.child(div().px(8).text_color(t.ansi1).child(d.error)))
            .when(!d, (e) => e.child(div().px(8).text_color(t.muted).child("Loading…")))
            .children(repos.map((r) => {
              const pr = this.prRows(r, t);
              return pr ? v_flex().flex_none().child(this.repoRow(g, r, t)).child(pr) : this.repoRow(g, r, t);
            }));
        })));
  }
}

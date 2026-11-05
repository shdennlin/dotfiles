// Markdown viewer: a pane that renders one markdown file (README, CLAUDE.md, AGENTS.md, a proposal...).
// Opened beside the terminal with `md <file>` (zsh) or pane.split {mod: "markdown-viewer", props: {file}}.
// It re-reads the file every 2 s, so it follows an agent that is editing it. Relative links to other
// markdown files open in the same viewer (← goes back); other links go to the system. The ↗ button opens
// the file in VS Code, the escalation path for anything heavier than reading.

import { View, div } from "gpui-kit";
import { v_flex, h_flex, TextView } from "gpui-base";
import { props, readTextFile, exec, theme, home } from "herdr";

const MAX_CHARS = 400_000;
const dirname = (p) => p.replace(/\/[^/]*$/, "") || "/";
const basename = (p) => p.split("/").pop();

// Resolve `rel` against directory `base`, collapsing . and .. (no filesystem access).
function resolvePath(base, rel) {
  const out = (rel.startsWith("/") ? [] : base.split("/")).filter(Boolean);
  for (const part of rel.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") out.pop(); else out.push(part);
  }
  return "/" + out.join("/");
}

export default class MarkdownViewer extends View {
  init(_props, cx) {
    this.file = props()?.file ?? null;
    this.stack = [];       // files we came from, for ←
    this.text = null;
    this.error = null;
    this.loadedFile = null;
    this.load(cx);
    cx.timer.every(2000, (cx) => this.load(cx));
  }

  load(cx) {
    const file = this.file;
    if (!file) return;
    cx.spawn(async (cx) => {
      let text = null;
      try { text = await readTextFile(file); } catch { text = null; }
      if (file !== this.file) return;                  // navigated away meanwhile
      if (text === null) {
        if (this.error !== "Cannot read this file") { this.error = "Cannot read this file"; this.text = null; cx.notify(); }
        return;
      }
      if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS) + "\n\n*… file truncated for display …*";
      if (text === this.text && file === this.loadedFile && !this.error) return;   // unchanged: no redraw
      this.text = text; this.error = null; this.loadedFile = file;
      cx.notify();
    });
  }

  go(file, cx) {
    this.stack.push(this.file);
    this.file = file; this.text = null; this.error = null; this.loadedFile = null;
    this.load(cx); cx.notify();
  }

  back(cx) {
    const prev = this.stack.pop();
    if (!prev) return;
    this.file = prev; this.text = null; this.error = null; this.loadedFile = null;
    this.load(cx); cx.notify();
  }

  link(url, cx) {
    if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) { exec("open", [url]); return; }
    let target = url.replace(/^file:\/\//, "").split("#")[0];
    try { target = decodeURIComponent(target); } catch { /* keep as is */ }
    if (!target) return;                                 // a pure #anchor: nothing to do
    const path = resolvePath(dirname(this.file), target);
    cx.spawn(async (cx) => {
      let isMarkdown = /\.(md|markdown)$/i.test(path);
      let exists = false;
      if (isMarkdown) { try { exists = (await readTextFile(path)) !== null; } catch { exists = false; } }
      if (isMarkdown && exists) this.go(path, cx);
      else exec("open", [path]);                         // an image, a source file, a folder...
    });
  }

  render(cx) {
    const t = theme();
    const where = this.file ? dirname(this.file).replace(home(), "~") : "";
    const button = (id, label, onClick, tip) => div().id(id).h(24).px(8).flex().items_center().rounded(6).flex_none()
      .cursor_pointer().text_size(12).text_color(t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => onClick(cx)).child(label);
    return v_flex().id("markdown-viewer").size_full().min_h(0).bg(t.background).text_color(t.foreground).text_size(14)
      .child(h_flex().h(34).flex_none().px(10).gap(8).items_center().border_b(1).border_color(t.border)
        .when(this.stack.length > 0, (e) => e.child(button("md-back", "←", (cx) => this.back(cx))))
        .child(div().flex_none().font_semibold().text_size(13).child(this.file ? basename(this.file) : "Markdown"))
        .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(t.dim).child(where))
        .when(Boolean(this.file), (e) => e.child(button("md-code", "↗ VS Code", () => exec("open", ["-a", "Visual Studio Code", this.file])))))
      .child(v_flex().id("md-scroll").flex_1().min_h(0).overflow_y_scrollbar()
        .child(div().w_full().max_w(900).px(28).py(18)
          .when(Boolean(this.error), (e) => e.child(div().text_color(t.ansi1).child(this.error)))
          .when(!this.file, (e) => e.child(div().text_color(t.dim).child("No file. Open one with: md <file>")))
          .when(this.text !== null, (e) => e.child(
            TextView.markdown("md-text", this.text ?? "").selectable(true).on_link_click((url, cx) => this.link(url, cx))))));
  }
}

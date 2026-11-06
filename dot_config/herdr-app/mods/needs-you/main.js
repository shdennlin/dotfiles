// needs-you: a drawer on the right edge that shows only while some tab needs you (status "blocked").
// Idle (and when the only blocked tab is the current one), it renders nothing, so the floating block has no size and costs no screen space. With a
// blocked tab, a pulsing "!" sits in the peek strip at the edge; hovering slides the drawer out to
// show the tab names, and a click goes to that tab.
//
// It is a floating block of the layout (see "floating" on work-body in layouts/shawn-style.json).

import { View, div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { spaces, panes, theme, placement, run } from "herdr";

const ROW_H = 32;
const PEEK = 36;      // width of the strip that always shows; must match "peek" in the layout
const LABEL_W = 220;  // width of the name part that slides out on hover
const EVERY_MS = 1000;

// Same tab label rule as the sidebar, picker-cards and tab-switcher.
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

export default class NeedsYou extends View {
  init(_props, cx) {
    this.key = "";
    cx.timer.every(EVERY_MS, (cx) => {
      const key = this.blocked().map((b) => `${b.tab.id}:${b.label}`).join("|");
      if (key !== this.key) { this.key = key; cx.notify(); }
    });
  }

  // Every tab whose own most-urgent status is blocked (the field the tab bar and the switcher read),
  // except the one you are on: you are already looking at it.
  blocked() {
    const ps = panes();
    return spaces().flatMap((w) => w.tabs
      .filter((t) => t.status === "blocked" && !(w.active && t.active))
      .map((tab) => ({ w, tab, label: `${w.name} · ${tabLabel(tab, ps)}` })));
  }

  go(b) {
    if (!b.w.active) run("space.select", { id: b.w.id });
    run("tab.select", { id: b.tab.id });
  }

  render(cx) {
    const list = this.blocked();
    this.key = list.map((b) => `${b.tab.id}:${b.label}`).join("|");
    if (!list.length) return div();   // nothing needs you: no size, nothing drawn
    const t = theme();
    const onRight = (placement()?.edge ?? "right") === "right";
    return v_flex().gap(2).py(4).children(list.map((b) => {
      // The edge side goes first in the peek strip, so it is what shows before hover.
      const mark = div().w(PEEK).h(ROW_H).flex_none().flex().items_center().justify_center()
        .child(div().size(18).rounded(9).flex().items_center().justify_center().bg(t.blocked).text_color(t.chrome)
          .text_size(12).font_semibold().child("!")
          .loop("opacity", { from: 0.4, to: 1, period: 1100 }));
      const name = div().w(LABEL_W).px(10).truncate().text_size(12).text_color(t.foreground).child(b.label);
      return h_flex().id(`ny-${b.tab.id}`).h(ROW_H).items_center().on_click(() => this.go(b))
        .children(onRight ? [name, mark] : [mark, name]);
    }));
  }
}

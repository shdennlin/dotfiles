# mdv — show a markdown file rendered, in the Herdr markdown-viewer pane. (Not `md`: oh-my-zsh
# already aliases that to `mkdir -p`.) Needs the Herdr app running, and jq.
#   mdv FILE      split a viewer beside the current pane (it follows edits, ← goes back after a link)
#   mdv -t FILE   open it as its own tab instead
#   mdv           pick a *.md from the current repo (submodules included) with fzf
mdv() {
  command -v herdr-app &>/dev/null || { print -u2 -- "mdv: herdr-app not found (run inside Herdr)"; return 1 }
  command -v jq &>/dev/null || { print -u2 -- "mdv: jq required"; return 1 }
  local as_tab=0 file=$1
  if [[ $1 == -t ]]; then as_tab=1; file=$2; fi
  if [[ -z $file ]]; then
    command -v fzf &>/dev/null || { print -u2 -- "mdv: give a file (fzf is needed to pick one)"; return 1 }
    local root=$(git rev-parse --show-toplevel 2>/dev/null || print -r -- $PWD) pick
    pick=$( { git -C $root ls-files --recurse-submodules -- '*.md' '*.markdown' 2>/dev/null \
              || (cd $root && find . -name '*.md' -not -path '*/node_modules/*' -not -path '*/.git/*' | sed 's|^\./||') } \
            | fzf --prompt='mdv> ' --preview "bat --style=plain --color=always $root/{} 2>/dev/null || head -60 $root/{}") || return 0
    [[ -z $pick ]] && return 0
    file=$root/$pick
  fi
  [[ -f $file ]] || { print -u2 -- "mdv: no such file: $file"; return 1 }
  file=${file:A}
  if (( as_tab )); then
    herdr-app do tab.new "$(jq -nc --arg f $file --arg n ${file:t} '{name: $n, mod: "markdown-viewer", props: {file: $f}}')" >/dev/null
  else
    herdr-app do pane.split "$(jq -nc --arg f $file '{direction: "right", mod: "markdown-viewer", props: {file: $f}}')" >/dev/null
  fi
}

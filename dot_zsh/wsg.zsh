# wsg — workspace graph: multi-repo git visualization for super-repo + submodule workflows
#
# Provides:
#   wsg [opts] [repos...]    — dump mini graph + status header per repo
#   wsg pick                 — fzf interactive picker with live graph preview
#   wsg wall [opts] [repos]  — tmux tiled multi-pane monitoring wall
#   wsg groups               — list defined repo groups
#   wsg fetch [repos]        — parallel `git fetch --all --prune` (safe anytime)
#   wsg pull [repos]         — parallel `git pull --ff-only`; skips detached HEAD
#   wsg -h | --help          — full help
#
# Discovery (when no repos given):
#   1. $WSG_ROOTS (colon-separated) → find -name .git
#   2. else if pwd is in a git repo → repo toplevel + submodules (recursive)
#   3. else → error hint
#
# Groups: define WSG_GROUPS[name]="repo1 repo2" in the groups file
# (default: $ZSH_CONFIG_DIR/wsg.groups.zsh, override with $WSG_GROUPS_FILE)
#
# Env vars:
#   WSG_ROOTS        — colon-separated search roots (unset by default)
#   WSG_DEPTH        — find max depth (default 4)
#   WSG_LINES        — commits per graph (default 20)
#   WSG_REFRESH      — `wsg wall` refresh seconds (default 10)
#   WSG_WALL_SUBJECT — `wsg wall` commit subject column width (default 0=full)
#                      set to e.g. 60 to truncate long subjects to one line
#   WSG_STATUS_MAX   — max `git status --short` lines per repo (default 8)
#   WSG_GROUPS_FILE  — path to groups file (default $ZSH_CONFIG_DIR/wsg.groups.zsh)
#   WSG_GROUPS_RAW   — inline groups as plain string (for direnv / CI):
#                      "name=repo1,repo2;name2=repo3,repo4"
#
# Deps: git (always), fzf (pick), tmux (wall). No `watch` needed — wall
# uses a native shell loop with `printf '\033[2J\033[H'` (ANSI clear).

typeset -gA WSG_GROUPS

# Absolute path of this file, captured at source time. `wsg wall` panes run
# in a fresh shell and re-source it to recompute the header every tick.
typeset -g _WSG_SELF=${${(%):-%x}:A}

: ${WSG_GROUPS_FILE:=${ZSH_CONFIG_DIR:-$HOME/.zsh}/wsg.groups.zsh}
[[ -f $WSG_GROUPS_FILE ]] && source $WSG_GROUPS_FILE

# Sed expression to compact git's `%ar` output ("3 days ago" → "3d").
# "ago" is implicit (git history is the past) so we drop it. Symbol choices:
#   s=seconds, min=minutes, h=hours, d=days, w=weeks, m=months, y=years
# `min` (not `m`) for minutes to disambiguate from months.
typeset -g _WSG_COMPACT_AGO='s/([0-9]+) seconds? ago/\1s/g; s/([0-9]+) minutes? ago/\1min/g; s/([0-9]+) hours? ago/\1h/g; s/([0-9]+) days? ago/\1d/g; s/([0-9]+) weeks? ago/\1w/g; s/([0-9]+) months? ago/\1m/g; s/([0-9]+) years? ago/\1y/g'

# Validate that $1 is a non-negative integer; print it if so, else print $2.
# Used to defend numeric env vars (WSG_LINES, WSG_REFRESH, etc.) against
# malformed values that would otherwise inject shell metacharacters via
# unquoted interpolation into the wall watch command.
_wsg_int() {
  [[ $1 == <-> ]] && print -r -- "$1" || print -r -- "$2"
}

# Tracks which WSG_GROUPS keys came from $WSG_GROUPS_RAW so we can clear
# them on reload — otherwise removing a group from RAW would silently
# leave the old entry behind (direnv reload would not really remove it).
typeset -ga _WSG_RAW_KEYS

# Parse $WSG_GROUPS_RAW (a plain-string env var, suitable for direnv / CI).
# Format: name=repo1,repo2;name2=repo3,repo4
# Separators: `;` OR newline between entries; `,` OR space between repos.
# Called at file load AND at the top of `wsg()` so direnv changes take effect.
# Caveat: if a group name is defined in BOTH the groups file AND RAW, the
# clear-and-reload step here will remove the file-defined version too.
_wsg_load_raw() {
  # Remove keys we previously sourced from RAW (so dropping an entry from
  # RAW removes it from WSG_GROUPS on next call).
  local k
  for k in $_WSG_RAW_KEYS; do
    unset "WSG_GROUPS[$k]"
  done
  _WSG_RAW_KEYS=()

  [[ -z $WSG_GROUPS_RAW ]] && return
  local normalized=${WSG_GROUPS_RAW//$'\n'/;}
  local entry name members
  for entry in ${(s.;.)normalized}; do
    entry=${entry##[[:space:]]##}
    entry=${entry%%[[:space:]]##}
    [[ -z $entry || $entry != *=* ]] && continue
    name=${entry%%=*}
    members=${entry#*=}
    WSG_GROUPS[$name]=${members//,/ }
    _WSG_RAW_KEYS+=($name)
  done
}
_wsg_load_raw

# ---- discovery -------------------------------------------------------------

# Discover repos via $WSG_ROOTS, or current git repo + submodules.
# Prints one path per line.
_wsg_discover() {
  if [[ -n $WSG_ROOTS ]]; then
    local depth=$(_wsg_int "${WSG_DEPTH}" 4)
    local -a roots
    roots=(${(s/:/)WSG_ROOTS})
    local r
    for r in $roots; do
      [[ -d ${~r} ]] || continue
      find ${~r} -maxdepth $depth -type d -name .git 2>/dev/null \
        | sed 's|/\.git$||'
    done
    return 0
  fi
  local top
  top=$(git rev-parse --show-toplevel 2>/dev/null) || return 1
  print -r -- $top
  # --recursive: include nested submodules (e.g. exploit-server/script/exploit-tools);
  # $displaypath carries the full relative prefix in recursive mode.
  git -C $top submodule foreach --quiet --recursive 'echo "$displaypath"' 2>/dev/null \
    | while read -r sub; do
        [[ -n $sub ]] && print -r -- "$top/$sub"
      done
}

# Resolve a single token to one or more repo paths.
# Token forms: /abs/path | ./rel | basename | @group-name
_wsg_expand_token() {
  local token=$1
  if [[ $token == @* ]]; then
    local group=${token#@}
    local members=${WSG_GROUPS[$group]}
    if [[ -z $members ]]; then
      print -u2 -- "wsg: unknown group @$group (try: wsg groups)"
      return 1
    fi
    local m
    for m in ${(z)members}; do _wsg_expand_token $m || return 1; done
    return 0
  fi
  if [[ -d $token ]] && git -C $token rev-parse --git-dir &>/dev/null; then
    print -r -- "${token:A}"
    return 0
  fi
  local p
  for p in ${(f)"$(_wsg_discover)"}; do
    if [[ ${p:t} == $token ]]; then
      print -r -- $p
      return 0
    fi
  done
  print -u2 -- "wsg: cannot resolve repo: $token"
  return 1
}

# ---- header (one-line status) ----------------------------------------------

# Build status header for $1, with ANSI colors per segment.
# Format: ═══ <name> · <branch> · <markers> · <ahead/behind> [· ⚙N stale] ═══
#
# Uses actual ESC bytes via $'\033' (not literal \033) so the resulting
# string can flow through ${(q)} and printf %s without escape interpretation.
_wsg_header() {
  # NOTE: never name a local var `path` — zsh ties $path to $PATH (array).
  local repo=$1
  local name=${repo:t}

  # ANSI palette (using actual ESC bytes; safe to embed in shell args)
  local E=$'\033'
  local C_FRAME="${E}[1;36m"     # bright cyan ═══
  local C_NAME="${E}[1;34m"      # bold blue for repo name (contrast vs other segments)
  local C_DOT="${E}[2m"          # dim · separator
  local C_BRANCH="${E}[32m"      # green for branch
  local C_DIRTY="${E}[1;33m"     # yellow for * + ?
  local C_CLEAN="${E}[2;32m"     # dim green for ≡
  local C_DETACH="${E}[1;33m"    # yellow for (detached @sha)
  local C_AHEAD="${E}[36m"       # cyan for ↑
  local C_BEHIND="${E}[31m"      # red for ↓
  local C_STALE="${E}[1;31m"     # bright red for ⚙ stale (warning)
  local C_ERR="${E}[31m"         # red for (unreachable)
  local R="${E}[0m"              # reset

  local info
  info=$(git -C $repo status --porcelain=v2 --branch 2>/dev/null) \
    || { print -r -- "${C_FRAME}═══${R} ${C_NAME}${name}${R} ${C_DOT}·${R} ${C_ERR}(unreachable)${R} ${C_FRAME}═══${R}"; return }

  local branch ab
  branch=$(print -r -- "$info" | awk '/^# branch.head/ {print $3; exit}')
  ab=$(print -r -- "$info" | awk '/^# branch.ab/ {print $3" "$4; exit}')

  local ahead=0 behind=0
  if [[ -n $ab ]]; then
    local a=${ab%% *}; ahead=${a#+}
    local b=${ab##* }; behind=${b#-}
  fi

  # status markers: * mod, + staged, ? untracked, ≡ clean
  local mod staged untracked
  mod=$(print -r -- "$info"      | awk '/^[12] / && substr($2,2,1) ~ /[MADRC]/' | wc -l | tr -d ' ')
  staged=$(print -r -- "$info"   | awk '/^[12] / && substr($2,1,1) ~ /[MADRC]/' | wc -l | tr -d ' ')
  untracked=$(print -r -- "$info"| awk '/^\?/'                                  | wc -l | tr -d ' ')

  local markers=""
  (( mod > 0 ))       && markers+="*"
  (( staged > 0 ))    && markers+="+"
  (( untracked > 0 )) && markers+="?"
  local marker_seg
  if [[ -z $markers ]]; then
    marker_seg="${C_CLEAN}≡${R}"
  else
    marker_seg="${C_DIRTY}${markers}${R}"
  fi

  # detached HEAD
  local branch_seg
  if [[ $branch == "(detached)" ]]; then
    local sha=$(git -C $repo rev-parse --short HEAD 2>/dev/null)
    branch_seg="${C_DETACH}(detached @${sha})${R}"
  else
    branch_seg="${C_BRANCH}${branch}${R}"
  fi

  # Assemble: ═══ name · branch · markers [· ↑N ↓M] [· ⚙N stale] ═══
  local out="${C_FRAME}═══${R} ${C_NAME}${name}${R} ${C_DOT}·${R} ${branch_seg} ${C_DOT}·${R} ${marker_seg}"
  if (( ahead > 0 || behind > 0 )); then
    local ab_seg=""
    (( ahead > 0 ))  && ab_seg+="${C_AHEAD}↑${ahead}${R}"
    (( behind > 0 )) && { [[ -n $ab_seg ]] && ab_seg+=" "; ab_seg+="${C_BEHIND}↓${behind}${R}"; }
    out+=" ${C_DOT}·${R} ${ab_seg}"
  fi

  # super-repo: count out-of-sync submodules
  if [[ -f $repo/.gitmodules ]]; then
    local stale
    stale=$(git -C $repo submodule status 2>/dev/null | grep -c '^[+\-U]')
    (( stale > 0 )) && out+=" ${C_DOT}·${R} ${C_STALE}⚙${stale} stale${R}"
  fi

  # closing frame
  out+=" ${C_FRAME}═══${R}"
  print -r -- "$out"
}

# ---- per-repo render -------------------------------------------------------

# Print short-status block (header + cap + truncation footer).
# Prints nothing if status is empty. Caller controls whether to invoke.
_wsg_status_block() {
  local repo=$1
  local s=$(git -C $repo status --short 2>/dev/null)
  [[ -z $s ]] && return
  printf '\e[2m── status ──\e[0m\n'
  local smax=$(_wsg_int "${WSG_STATUS_MAX}" 8)
  local total=$(print -r -- "$s" | wc -l | tr -d ' ')
  if (( total > smax )); then
    print -r -- "$s" | head -$smax
    print -- "  ... +$((total - smax)) more"
  else
    print -r -- "$s"
  fi
  printf '\n'
}

# Print header (with ─ padding) + optional short status + graph.
# Status comes BEFORE graph so it stays visible when terminal is short.
# Args: repo, show_status, width
_wsg_render_one() {
  local repo=$1
  local show_status=${2:-0}
  local width=${3:-100}

  # _wsg_header already returns a fully colored "═══ ... ═══" line.
  # Just emit it as-is (escapes are real ESC bytes, terminal interprets).
  local header=$(_wsg_header $repo)
  print -r -- "$header"

  # status first (more actionable than history)
  (( show_status )) && _wsg_status_block $repo

  # graph: compact format if narrow. Pipe through sed to compact "%ar"
  # ("3 days ago" → "3d") for max info density per line.
  local -a fmt
  if (( width < 60 )); then
    fmt=(--format='%C(yellow)%h%C(reset) %C(dim white)%ar%C(reset) %<(40,trunc)%s')
  else
    fmt=(--format='%C(yellow)%h%C(reset) %C(dim white)%ar%C(reset)%C(auto)%d%C(reset) %s')
  fi
  local lines=$(_wsg_int "${WSG_LINES}" 20)
  git -C $repo log --graph $fmt --all -$lines --color=always 2>/dev/null \
    | sed -E "$_WSG_COMPACT_AGO"
  printf '\n'
}

# ---- subcommand: dump ------------------------------------------------------

_wsg_cmd_dump() {
  local show_status=0
  local -a paths
  while [[ $# -gt 0 ]]; do
    case $1 in
      -s|--status) show_status=1; shift ;;
      -n|--lines)  WSG_LINES=$2; shift 2 ;;
      -h|--help)   _wsg_help; return 0 ;;
      *)
        local out
        out=$(_wsg_expand_token $1) || return 1
        paths+=(${(f)out})
        shift
        ;;
    esac
  done

  if (( ${#paths} == 0 )); then
    paths=(${(f)"$(_wsg_discover)"})
  fi
  if (( ${#paths} == 0 )); then
    print -u2 -- "wsg: no repos found."
    print -u2 -- "    cd into a git repo, or set WSG_ROOTS, or pass a path / @group."
    return 1
  fi

  local width=$(( ${COLUMNS:-0} > 0 ? COLUMNS : $(tput cols 2>/dev/null || echo 100) ))
  (( width < 40 )) && { print -u2 -- "wsg: terminal too narrow (need >=40 cols)"; return 1 }

  local p
  for p in $paths; do _wsg_render_one $p $show_status $width; done | less -RFX
}

# ---- subcommand: pick ------------------------------------------------------

_wsg_cmd_pick() {
  command -v fzf &>/dev/null || { print -u2 -- "wsg: fzf required"; return 1 }
  local -a paths
  paths=(${(f)"$(_wsg_discover)"})
  (( ${#paths} == 0 )) && { print -u2 -- "wsg: no repos found"; return 1 }

  local lines=$(_wsg_int "${WSG_LINES}" 20)
  local listing="" p hdr
  for p in $paths; do
    hdr=$(_wsg_header $p)
    listing+="${hdr}	${p}"$'\n'
  done

  # Preview prints status first (only if non-empty), then graph with timestamp.
  # All quoting is single-line to keep fzf --preview happy.
  local preview_cmd='s=$(git -C {2} status --short 2>/dev/null); [ -n "$s" ] && { printf "\033[2m── status ──\033[0m\n"; echo "$s"; echo; }; git -C {2} log --graph --format="%C(auto)%h%C(reset) %C(dim white)%ar%C(reset)%C(auto)%d%C(reset) %s" --all -'$lines' --color=always 2>/dev/null | sed -E "'$_WSG_COMPACT_AGO'"'
  print -rn -- "$listing" | fzf \
    --multi \
    --ansi \
    --delimiter=$'\t' \
    --with-nth=1 \
    --preview="$preview_cmd" \
    --preview-window='right:60%:wrap' \
    --bind='ctrl-/:change-preview-window(down,60%|hidden|right,60%)'
}

# ---- subcommand: wall ------------------------------------------------------

_wsg_cmd_wall() {
  command -v tmux &>/dev/null || { print -u2 -- "wsg: tmux required"; return 1 }
  [[ -z $TMUX ]] && { print -u2 -- "wsg: must be inside a tmux session"; return 1 }

  local layout=tiled
  local show_status=1  # default ON for wall (monitoring → status is the point)
  local -a tokens
  while [[ $# -gt 0 ]]; do
    case $1 in
      -l|--layout)    layout=$2; shift 2 ;;
      -s|--status)    show_status=1; shift ;;   # explicit on (redundant w/ default)
      -S|--no-status) show_status=0; shift ;;   # opt-out
      -h|--help)      _wsg_help; return 0 ;;
      *)              tokens+=($1); shift ;;
    esac
  done

  local -a paths
  if (( ${#tokens} > 0 )); then
    local t out
    for t in $tokens; do
      out=$(_wsg_expand_token $t) || return 1
      paths+=(${(f)out})
    done
  else
    local picked
    picked=$(_wsg_cmd_pick) || return 0
    [[ -z $picked ]] && return 0
    paths=(${${(f)picked}##*$'\t'})
  fi
  (( ${#paths} == 0 )) && { print -u2 -- "wsg: no repos selected"; return 1 }

  local tmux_layout
  case $layout in
    tiled) tmux_layout=tiled ;;
    cols)  tmux_layout=even-horizontal ;;
    rows)  tmux_layout=even-vertical ;;
    main)  tmux_layout=main-vertical ;;
    mainh) tmux_layout=main-horizontal ;;
    *) print -u2 -- "wsg: unknown layout '$layout' (use tiled|cols|rows|main|mainh)"; return 1 ;;
  esac

  local refresh=$(_wsg_int "${WSG_REFRESH}" 10)
  local lines=${WSG_LINES:-20}

  # Build the per-pane refresh command for a given raw repo path.
  # Order: header → status (if any) → graph. Header identifies the pane;
  # status is the most actionable info; graph is the historical context.
  #
  # Implementation: explicit `while true; clear; ...; sleep N; done` loop
  # instead of `watch`. Reasons:
  #   1. No external dependency (`watch` is procps, not on default macOS)
  #   2. Better SIGWINCH behavior — `clear` runs each tick so pane resize
  #      gets a clean redraw on next iteration (some `watch` builds defer
  #      redraw until the next tick AND mis-handle multi-pane resize)
  #   3. Simpler quoting — no nested `-c '...'` layer
  local smax=$(_wsg_int "${WSG_STATUS_MAX}" 8)
  local subj_width=$(_wsg_int "${WSG_WALL_SUBJECT}" 0)  # 0 = full (wrap); N = truncate to N
  _wsg_wall_cmd() {
    local repo=$1
    local pq=${(q)repo}
    # Header is recomputed EVERY tick so ↑N ↓M / markers / ⚙ stale / branch
    # reflect `wsg fetch` / `wsg pull` / checkouts without relaunching the wall.
    # The pane shell doesn't have wsg's functions, so it spawns `zsh -f` that
    # re-sources this file ($_WSG_SELF) and calls _wsg_header. Nested ${(q)}:
    # inner quotes the args for the zsh -c script, outer quotes that script
    # as one word for the pane shell.
    local header_script="source ${(q)_WSG_SELF}; _wsg_header ${(q)repo}"
    local header_cmd="zsh -fc ${(q)header_script}"

    # Default log format: short hash, dim relative timestamp, decorations,
    # subject. %ar is "3 days ago"-style; we pipe through sed to compact
    # ("3 days ago" → "3d") for max info density per line.
    local log_fmt
    if (( subj_width > 0 )); then
      # When subject truncation is requested, encode the whole format in
      # one --format=… arg (double-quoted so the embedded space stays in
      # one shell token for git after sh re-parses).
      log_fmt='--format="%C(auto)%h%C(reset) %C(dim white)%ar%C(reset)%C(auto)%d%C(reset) %<('$subj_width',trunc)%s"'
    else
      log_fmt='--format="%C(auto)%h%C(reset) %C(dim white)%ar%C(reset)%C(auto)%d%C(reset) %s"'
    fi
    local graph_part="git -C $pq log --graph $log_fmt --all -$lines --color=always | sed -E '$_WSG_COMPACT_AGO'"

    # Build the status sub-pipeline. We pre-compute the total line count
    # with `wc -l < <file>` BEFORE piping the file to head, because the
    # naive `{ head -N; n=$(wc -l); ... }` pattern fails: head's buffered
    # I/O drains the pipe so wc reads 0 and the "+N more" footer is never
    # printed. The fix uses a temp file via process substitution so both
    # head and wc can independently consume the full content.
    local body
    if (( show_status )); then
      body="$header_cmd; "'s=$(git -C '$pq' status --short); if [ -n "$s" ]; then total=$(printf %s "$s" | grep -c .); echo "── status ──"; printf %s "$s" | head -'$smax'; echo; [ "$total" -gt '$smax' ] && echo "  ... +$((total - '$smax')) more"; echo; fi; '$graph_part
    else
      body="$header_cmd; $graph_part"
    fi
    # ANSI escapes per tick:
    #   \033[?7l  — disable auto-wrap: long lines hard-cut at pane width
    #               (without this, long commit subjects wrap to 2+ physical
    #               lines, exceeding pane height even though `head` says OK)
    #   \033[2J   — clear screen
    #   \033[H    — cursor to home (1,1)
    # `| head -n $((H-1))` caps total LOGICAL lines to one less than pane
    # height — combined with auto-wrap-off, the output never triggers scroll.
    #
    # Why "H-1" not "H": each output line ends with \n; writing exactly H
    # lines means cursor advances past line H → terminal scrolls UP by 1,
    # pushing the header (line 1) into scrollback. Leaving 1 blank row at
    # the bottom is harmless; losing the header is the bug we're fixing.
    #
    # Why `stty size` not `tput lines`: tput in a non-interactive subshell
    # falls back to terminfo's static `lines#` capability (usually 24),
    # NOT the live pane size. `stty size` reads TIOCGWINSZ from the tty,
    # which IS the pane size and updates on SIGWINCH.
    #
    # `sleep 0.3` BEFORE the loop: pane creation + select-layout takes
    # a few ms; without delay the first tick may read pre-resize size.
    # awk: BEGIN sets default 24, first record overrides, END always prints.
    # This survives stty failure (no records) and gives head a sane value.
    #
    # `trap ... EXIT` restores \033[?7h (auto-wrap on) when the loop dies
    # (Ctrl-C, SIGTERM, normal exit). Without this, killing the wall loop
    # while keeping the pane open leaves the terminal in wrap-off forever.
    printf 'trap "printf \\"\\033[?7h\\"" EXIT; sleep 0.3; while true; do printf "\\033[?7l\\033[2J\\033[H"; { %s; } | head -n $(($(stty size 2>/dev/null | awk "BEGIN{n=24}{n=\\$1}END{print n}") - 1)); sleep %s; done' "$body" $refresh
  }

  # Derive window name from args so different groups coexist:
  #   wsg wall @payment   → "wsg-wall-payment"
  #   wsg wall @auth      → "wsg-wall-auth"      (both windows alive)
  #   wsg wall @payment   → overwrites "wsg-wall-payment" (same group)
  #   wsg wall repo1 ...  → "wsg-wall-repo1"     (uses first basename)
  #   wsg wall (no args)  → "wsg-wall"           (fzf-picker path)
  local wname=wsg-wall
  if (( ${#tokens} > 0 )); then
    local first=${tokens[1]}
    if [[ $first == @* ]]; then
      wname="wsg-wall-${first#@}"
    else
      wname="wsg-wall-${first:t}"  # basename for paths
    fi
    # Sanitize: tmux dislikes some chars in window names
    wname=${wname//[^a-zA-Z0-9_-]/-}
  fi

  # Kill only the SAME-named window (so different groups don't clobber each
  # other). Without this, re-running wsg wall would leave zombie panes
  # running the OLD watch command. 2>/dev/null swallows "no such window".
  tmux kill-window -t "$wname" 2>/dev/null

  # `-c <repo>` sets each pane's cwd to the repo path. This makes tmux's
  # built-in `#{pane_current_path}` resolve to the repo, so users can bind
  # integrations in tmux.conf without wsg needing to know about them:
  #   bind o run-shell 'code "#{pane_current_path}"'         # open in VSCode
  #   bind g run-shell 'gh repo view --web -R "#{pane_current_path}"'
  #   bind -n DoubleClick1Pane run-shell 'code "#{pane_current_path}"'
  tmux new-window -n "$wname" -c "${paths[1]}" "$(_wsg_wall_cmd ${paths[1]})"
  local p
  for p in $paths[2,-1]; do
    tmux split-window -t "$wname" -c "$p" "$(_wsg_wall_cmd $p)"
  done
  tmux select-layout -t "$wname" $tmux_layout

  # Record the directory `wsg wall` was launched from (typically the
  # super-repo root). User-defined tmux bindings can read this via
  # #{@wsg_launch_dir} — useful for IDEs that prefer opening the whole
  # project rather than an individual submodule:
  #   bind O run-shell 'code "#{@wsg_launch_dir}"'    # open super-repo
  #   bind G run-shell 'gh repo view --web -R "#{pane_current_path}"'
  tmux set-option -t "$wname" -w @wsg_launch_dir "$PWD"

  unfunction _wsg_wall_cmd
}

# ---- subcommand: fetch / pull ----------------------------------------------

# Pick the informative line out of git's stderr: the first fatal:/error: line
# (git often ends with a generic "Aborting"), else the last line.
_wsg_errline() {
  local hit=${${(M)${(f)1}:#(fatal|error):*}[1]}
  print -r -- ${hit:-${1##*$'\n'}}
}

# One repo, one result line. Args: mode (fetch|pull), repo path.
#   ✓ changed   · no-op   ⏭ skipped   ✗ failed (git's fatal:/error: line)
# fetch: "changed" = any remote-tracking ref moved/appeared/was pruned;
#   ↓N is appended whenever HEAD is behind its upstream, changed or not.
# --no-recurse-submodules: repos run in parallel and each submodule is already
# its own job; letting the super's fetch recurse (fetch.recurseSubmodules
# defaults to on-demand) would race the submodule's own job for ref locks.
_wsg_sync_one() {
  local mode=$1 repo=$2 name=${2:t} err
  if [[ $mode == fetch ]]; then
    local refs_before refs_after behind mark='·'
    refs_before=$(git -C $repo for-each-ref --format='%(objectname) %(refname)' refs/remotes)
    err=$(git -C $repo fetch --all --prune --quiet --no-recurse-submodules 2>&1) \
      || { print -r -- "✗ $name: $(_wsg_errline $err)"; return }
    refs_after=$(git -C $repo for-each-ref --format='%(objectname) %(refname)' refs/remotes)
    [[ $refs_before != $refs_after ]] && mark='✓'
    behind=$(git -C $repo rev-list --count HEAD..@{u} 2>/dev/null)
    if [[ -n $behind && $behind != 0 ]]; then
      print -r -- "$mark $name ↓$behind"
    else
      print -r -- "$mark $name"
    fi
    return
  fi

  # pull: fast-forward only, never manufacture a merge commit in a batch op
  git -C $repo symbolic-ref -q HEAD >/dev/null \
    || { print -r -- "⏭ $name (detached)"; return }
  git -C $repo rev-parse -q --verify @{u} >/dev/null 2>&1 \
    || { print -r -- "⏭ $name (no upstream)"; return }
  local before after
  before=$(git -C $repo rev-parse --short HEAD)
  err=$(git -C $repo pull --ff-only --quiet --no-recurse-submodules 2>&1) \
    || { print -r -- "✗ $name ($(git -C $repo branch --show-current)): $(_wsg_errline $err)"; return }
  after=$(git -C $repo rev-parse --short HEAD)
  if [[ $before == $after ]]; then
    print -r -- "· $name"
  else
    print -r -- "✓ $name $before..$after (+$(git -C $repo rev-list --count $before..$after))"
  fi
}

# Run _wsg_sync_one over all resolved repos in parallel; print results in
# discovery order (each job writes its own temp file, printed after wait).
# Returns 1 if any repo failed.
_wsg_cmd_sync() {
  local mode=$1; shift
  local -a paths
  local t out
  for t in "$@"; do
    [[ $t == -h || $t == --help ]] && { _wsg_help; return 0 }
    out=$(_wsg_expand_token $t) || return 1
    paths+=(${(f)out})
  done
  (( ${#paths} == 0 )) && paths=(${(f)"$(_wsg_discover)"})
  (( ${#paths} == 0 )) && { print -u2 -- "wsg: no repos found"; return 1 }

  setopt local_options no_monitor no_notify
  local tmp=$(mktemp -d) i
  local -a pids
  for i in {1..${#paths}}; do
    _wsg_sync_one $mode ${paths[i]} >$tmp/$i &
    pids+=($!)
  done
  # Wait only on our own jobs: wsg runs in the interactive shell, so a bare
  # `wait` would also block on the user's unrelated background jobs.
  wait $pids

  local rc=0
  for i in {1..${#paths}}; do
    cat $tmp/$i
    grep -q '^✗' $tmp/$i && rc=1
  done
  rm -rf $tmp
  return $rc
}

# ---- subcommand: groups ----------------------------------------------------

_wsg_cmd_groups() {
  if (( ${#WSG_GROUPS} == 0 )); then
    print -- "No groups defined. Add some via either:"
    print -- "  1. Edit $WSG_GROUPS_FILE"
    print -- "  2. Add WSG_GROUPS[name]=\"repo1 repo2\" to your .zshrc"
    print -- "(override file path with: export WSG_GROUPS_FILE=/your/path.zsh)"
    return 0
  fi
  print -- "# WSG_GROUPS_FILE = $WSG_GROUPS_FILE"
  print -- "# (groups may also be defined inline in .zshrc / direnv / etc.)"
  local g
  for g in ${(ok)WSG_GROUPS}; do
    print -r -- "@$g  →  ${WSG_GROUPS[$g]}"
  done
}

# ---- help ------------------------------------------------------------------

_wsg_help() {
  cat <<'EOF'
wsg — workspace graph: multi-repo git visualization

USAGE
  wsg [opts] [repos...]      dump mini graph + status header per repo (less -R)
  wsg pick | p               fzf interactive picker with live graph preview
  wsg wall | w [opts] [repos] tmux tiled monitoring wall (must be inside tmux)
  wsg groups | g             list defined repo groups
  wsg fetch | f [repos]      parallel 'git fetch --all --prune' (never touches
                             working trees; shows ↓N behind upstream)
  wsg pull | pl [repos]      parallel 'git pull --ff-only'; skips detached HEAD
                             and branches with no upstream; never merges
  wsg -h | --help            this help

  Subcommand shortcuts: p = pick, w = wall, g = groups, f = fetch, pl = pull

  Typical loop: keep 'wsg wall' open, run 'wsg f', read ↓N in the pane
  headers (recomputed every tick), then 'wsg pl' when ready.

DUMP OPTIONS
  -s, --status             also show 'git status --short' under each graph
  -n N, --lines N          show N commits per graph (default 20)

WALL OPTIONS
  -l NAME, --layout NAME   tiled (default) | cols | rows | main | mainh
  -s, --status             show 'git status --short' in each pane (DEFAULT)
  -S, --no-status          suppress status block (graph only)

REPO TOKENS
  /abs/path or ./rel       use that path directly
  name                     look up by basename in discovered repos
  @group-name              expand from $WSG_GROUPS (see 'wsg groups')

DISCOVERY (when no repos given)
  1. $WSG_ROOTS (colon-separated) → find -name .git -maxdepth $WSG_DEPTH
  2. else if pwd in git repo → toplevel + submodules (recursive, incl. nested)
  3. else → error hint

ENV VARS
  WSG_ROOTS        colon-separated search roots (unset by default)
  WSG_DEPTH        find max depth (default 4)
  WSG_LINES        commits per graph (default 20)
  WSG_REFRESH      'wsg wall' refresh seconds (default 10)
  WSG_WALL_SUBJECT 'wsg wall' commit subject width (default 0 = no truncation;
                   set N to cap each commit subject at N chars / 1 line)
  WSG_STATUS_MAX   max 'git status --short' lines per repo (default 8)
                   excess lines collapsed to "... +N more"
  WSG_GROUPS_FILE  path to groups file
                   (default $ZSH_CONFIG_DIR/wsg.groups.zsh)
  WSG_GROUPS_RAW   inline groups as plain exportable string (for direnv/CI)
                   format: "name=repo1,repo2;name2=repo3,repo4"
                   separators: ';' or newline between entries;
                               ',' or space between repos

GROUPS
  WSG_GROUPS is a global zsh associative array. Define entries any of these:
    1. In $WSG_GROUPS_FILE (default, chezmoi-tracked):
         WSG_GROUPS[payment]="super-repo auth api frontend"
    2. Inline in .zshrc (after wsg.zsh is sourced):
         WSG_GROUPS[basic]="super-repo docs api-contract"
    3. Via direnv .envrc — must use WSG_GROUPS_RAW (bash can't export
       assoc arrays):
         export WSG_GROUPS_RAW="basic=super-repo,docs,api-contract;\\
service=api-contract,core-api,central,frontend"
  All sources merge. WSG_GROUPS_RAW is re-parsed on every 'wsg' call,
  so direnv changes take effect immediately. Inspect with: wsg groups
EOF
}

# ---- entry point -----------------------------------------------------------

wsg() {
  _wsg_load_raw  # re-parse $WSG_GROUPS_RAW so direnv updates take effect
  local sub=$1 resolved
  case $sub in
    pick|p)    resolved=pick ;;
    wall|w)    resolved=wall ;;
    groups|g)  resolved=groups ;;
    fetch|f)   resolved=fetch ;;
    pull|pl)   resolved=pull ;;
    -h|--help) resolved=help ;;
    *)         resolved=dump ;;
  esac
  # 30-day usage log (2026-05-25 ~ 2026-06-25, for 砍-feature evaluation):
  #   awk '{print $2}' ~/.cache/wsg-usage.log | sort | uniq -c | sort -rn
  [[ -d $HOME/.cache ]] || mkdir -p $HOME/.cache
  print -r -- "$(date +%Y-%m-%d_%H:%M) $resolved" >> $HOME/.cache/wsg-usage.log

  case $sub in
    pick|p)    shift; _wsg_cmd_pick "$@" ;;
    wall|w)    shift; _wsg_cmd_wall "$@" ;;
    groups|g)  shift; _wsg_cmd_groups "$@" ;;
    fetch|f)   shift; _wsg_cmd_sync fetch "$@" ;;
    pull|pl)   shift; _wsg_cmd_sync pull "$@" ;;
    -h|--help) _wsg_help ;;
    *)         _wsg_cmd_dump "$@" ;;
  esac
}

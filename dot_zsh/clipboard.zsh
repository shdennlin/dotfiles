# Clipboard utilities — cross-platform clip/paste + cp* family + copybuffer
#
# Depends on: clipcopy/clippaste from omz lib/clipboard (loaded via znap in
# .zshrc). All blocks are gated by `$+functions[clipcopy]` so this file
# fails gracefully if the omz lib didn't load.
#
# In SSH context, clipcopy is wrapped to use OSC 52 — the clipboard write
# is sent via terminal escape sequences and the LOCAL terminal (Ghostty,
# iTerm2, kitty, WezTerm, etc.) intercepts and writes to the local
# clipboard. No daemons, no port forwarding. Works through tmux via DCS
# passthrough. Apple Terminal does not support OSC 52.
#
# Provides:
#   c, C (global), pwdc      — short-form copy aliases (C/pwdc tee to terminal)
#   Ctrl+O                   — copybuffer (copies current command-line buffer)
#   cpc / cpc -d             — copy last command (bare / with workdir comment)
#   cpw <cmd>                — run cmd + auto-copy [path]/# ts/$cmd/<output>
#       aliases: cw, X, ','  — short forms for cpw (trial: pick the one that sticks)
#   cpr [N]                  — quick replay slot N from history (0 = newest)
#   cph                      — interactive history picker (fzf w/ preview, or list fallback)
#   --help / -h on any cp*   — shared help (see _cp_help)
#
# Storage: ~/.cache/zsh-clip/  (20-slot ring buffer)

# Cross-platform clipboard: clipcopy/clippaste come from omz lib/clipboard
# (loaded via znap in .zshrc). Falls back across pbcopy / xclip / xsel /
# wl-copy / clip.exe / tmux buffer / etc. so cp* works on macOS, Linux, WSL,
# SSH (lemonade), Termux, and tmux without code changes.
#
# OSC 52 wrap: in SSH context use OSC 52 escape sequence to bridge the
# clipboard back to the LOCAL terminal; otherwise fall through to omz's
# detected native tool. clippaste is left untouched (omz's native still
# works locally; reading clipboard via OSC 52 is gated by terminals for
# security and not worth bypassing).
if (( $+functions[clipcopy] )) && (( $+functions[detect-clipboard] )); then
    # Force omz lazy detection now to resolve clipcopy to its platform
    # impl. Without this we'd snapshot omz's lazy stub, which calls itself
    # by name and would infinite-loop after we shadow it. Calling clipcopy
    # directly would empty the system clipboard as a side effect, so call
    # detect-clipboard instead — it only redefines functions.
    detect-clipboard 2>/dev/null

    # Snapshot omz's resolved native clipcopy so we can fall through to it
    # for non-SSH usage.
    functions[_native_clipcopy]=$functions[clipcopy]

    # Send payload via OSC 52 escape sequence to the controlling terminal
    # (/dev/tty, not stdout — stdout could be redirected). Inside tmux,
    # wrap in DCS passthrough so tmux forwards to the outer terminal
    # (requires `set -g allow-passthrough on` in tmux.conf, tmux 3.3+).
    _osc52_clipcopy() {
        emulate -L zsh
        local content
        content=$(cat "${1:-/dev/stdin}" | base64 | tr -d '\n')
        # 2>/dev/null: silently no-op if /dev/tty isn't writable
        # (e.g., non-interactive shell). Better than spewing errors.
        if [[ -n "$TMUX" ]]; then
            printf '\ePtmux;\e\e]52;c;%s\a\e\\' "$content" > /dev/tty 2>/dev/null
        else
            printf '\e]52;c;%s\a' "$content" > /dev/tty 2>/dev/null
        fi
    }

    # New clipcopy: dispatch on SSH presence. Every cp* caller automatically
    # benefits — they all funnel through clipcopy.
    clipcopy() {
        if [[ -n "$SSH_CONNECTION$SSH_TTY" ]]; then
            _osc52_clipcopy "$@"
        else
            _native_clipcopy "$@"
        fi
    }
fi

# Short-form aliases. C and pwdc tee to /dev/tty so the output is visible
# on screen as well as copied (vs `c`, which stays silent for scripting use).
if (( $+functions[clipcopy] )); then
    alias c=clipcopy
    alias -g C='| tee /dev/tty | clipcopy'
    alias -g pwdc='pwd | tee /dev/tty | clipcopy'
fi

# copybuffer — Ctrl+O copies the current command-line buffer (pre-run capture).
# Complementary to cp* (post-run). $BUFFER is only meaningful inside a ZLE widget.
if (( $+functions[clipcopy] )); then
    copybuffer() { print -rn -- "$BUFFER" | clipcopy }
    zle -N copybuffer
    bindkey -M emacs '^O' copybuffer
    bindkey -M viins '^O' copybuffer
    bindkey -M vicmd '^O' copybuffer
fi

# copy command (and optionally path/output) to clipboard, with replay history
if (( $+functions[clipcopy] )); then
    typeset -g  _CP_DIR=~/.cache/zsh-clip
    typeset -gi _CP_KEEP=20
    _cp_last() { fc -ln -1 | sed 's/^ *//' }

    # _cp_send — pipe payload here: ring-buffer rotate + clipcopy
    _cp_send() {
        [[ -d $_CP_DIR ]] || mkdir -p $_CP_DIR
        local idx=0
        [[ -s $_CP_DIR/.idx ]] && idx=$(<$_CP_DIR/.idx)
        idx=$(( (idx + 1) % _CP_KEEP ))
        print -- $idx > $_CP_DIR/.idx
        tee "$_CP_DIR/$idx" | clipcopy
    }

    # _cp_help — shared help text (any cp* --help shows this)
    _cp_help() {
        cat <<EOF
cp* family — copy command/output to clipboard

  cpc           copy: <cmd>                          (bare, paste-runable)
  cpc -d        copy: # workdir: <path>              (annotated for re-run elsewhere)
                      <cmd>
  cpw <cmd>     run + copy:  [path] / \$ <cmd> / <output>
                short aliases:  cw  /  X  /  ,
  cpr [N]       quick replay slot N to clipboard    (default 0 = newest)
  cph           interactive history picker          (fzf with preview; Tab = multi-select → concat)

  --help, -h    show this help (works on any cp* command)

Storage: $_CP_DIR  (rm -rf to clear all replay history)
EOF
    }

    # cpc — bare command (paste-runable). With -d, prepends "# workdir: <path>".
    cpc() {
        [[ $1 == --help || $1 == -h ]] && { _cp_help; return }
        if [[ $1 == -d ]]; then
            {
                print -r -- "# workdir: ${PWD/#$HOME/~}"
                print -r -- "$(_cp_last)"
            } | _cp_send
            print "✓ cmd+workdir"
        else
            print -r -- "$(_cp_last)" | _cp_send && print "✓ cmd"
        fi
    }

    # cpw — wrap & run; auto-copies [path] + # timestamp + $ cmd + output
    #
    # Builds a shell-runnable command string from the args, then runs it
    # under script(1) to provide a pty so the wrapped command (eza, ls,
    # grep, git, bat, etc.) keeps its colors visible on the terminal:
    #
    #   - $1 is alias       → expand via $aliases[name], append remaining
    #                          args (quoted), pass to `sh -c`
    #   - $1 is binary      → quote all args, pass to `sh -c`
    #   - $1 is function/builtin → cmd_string stays empty, fall back to eval
    #
    # Falling through to `sh -c` (rather than exec'ing argv directly) lets
    # alias bodies containing pipes/redirects work naturally. After alias
    # expansion we re-check that the first word is a real binary, since
    # an alias could resolve to another function (e.g. `cw → cpw`).
    #
    # The output stream is split: tee /dev/tty shows it on the terminal
    # (with colors), then sed+tr strip ANSI escapes and pty control bytes
    # so the clipboard payload is plain text suitable for pasting. macOS
    # BSD script appends a literal `^D\b\b` end-of-file marker that's
    # invisible on a TTY but shows up when piped — the trailing sed
    # strips that line-1 prefix.
    cpw() {
        [[ $# -eq 1 && ( $1 == --help || $1 == -h ) ]] && { _cp_help; return }
        local buf; buf=$(mktemp) || return 1

        local cmd_string="" first_word=""
        if [[ -n "${aliases[$1]:-}" ]]; then
            cmd_string="${aliases[$1]}"
            local arg
            for arg in "${@:2}"; do cmd_string+=" ${(q)arg}"; done
            first_word="${${(z)cmd_string}[1]}"
        elif [[ -n "$(whence -p "$1" 2>/dev/null)" ]]; then
            cmd_string="${(q)1}"
            local arg
            for arg in "${@:2}"; do cmd_string+=" ${(q)arg}"; done
            first_word="$1"
        fi

        {
            if [[ -n "$cmd_string" ]] && (( $+commands[script] )) \
               && [[ -n "$(whence -p "$first_word" 2>/dev/null)" ]]; then
                case "$OSTYPE" in
                    darwin*|freebsd*|netbsd*) script -q /dev/null sh -c "$cmd_string" 2>&1 ;;
                    linux*)                   script -qc "$cmd_string" /dev/null 2>&1 ;;
                    *)                        eval "$@" 2>&1 ;;
                esac
            else
                eval "$@" 2>&1
            fi
        } | tee /dev/tty 2>/dev/null \
          | sed -E $'s/\x1b\\[[0-9;?]*[a-zA-Z]//g; s/\x1b\\][^\x07]*\x07//g' \
          | LC_ALL=C tr -d '\001-\010\013\014\015\016-\037\177' \
          | sed -E '1s/^\^D//' \
          > "$buf"
        {
            print -r -- "[${PWD/#$HOME/~}]"
            print -r -- "# $(date '+%Y-%m-%d %H:%M:%S')"
            print -r -- "$ $*"
            cat "$buf"
        } | _cp_send
        rm -f "$buf"
        print "✓ all (copied)"
    }
    (( $+functions[compdef] )) && compdef _precommand cpw
    # short aliases for cpw (trial)
    for _n in cw X ','; do
        alias "$_n=cpw"
        (( $+functions[compdef] )) && compdef _precommand "$_n"
    done
    unset _n

    # cpr [N] — replay N-th-back copy (0 = most recent, default)
    cpr() {
        [[ $1 == --help || $1 == -h ]] && { _cp_help; return }
        local back=${1:-0}
        [[ -s $_CP_DIR/.idx ]] || { print "✗ no copies yet"; return 1 }
        local cur=$(<$_CP_DIR/.idx)
        local n=$(( (cur - back + _CP_KEEP) % _CP_KEEP ))
        local f=$_CP_DIR/$n
        [[ -s $f ]] || { print "✗ no copy at -$back"; return 1 }
        clipcopy < "$f"
        print "✓ replayed -$back:"
        head -3 "$f" | sed 's/^/  /'
    }

    # _cp_slots — emit slot data as TSV: <back_idx>\t<filepath>\t<cmd>\t<dir>\t<ts>
    # ts is empty for legacy slots and cpc/cpc -d entries.
    # NOTE: avoid `local path` — zsh ties $path (array) to $PATH (string) via
    # typeset -aT, so `local path` empties $PATH inside the function and
    # external commands like `sed` become "command not found". Use `dir` etc.
    _cp_slots() {
        [[ -s $_CP_DIR/.idx ]] || return 1
        local cur=$(<$_CP_DIR/.idx)
        local i n f line1 line2 line3 cmd dir ts
        for ((i=0; i<_CP_KEEP; i++)); do
            n=$(( (cur - i + _CP_KEEP) % _CP_KEEP ))
            f=$_CP_DIR/$n
            [[ -s $f ]] || continue
            line1=$(sed -n '1p' "$f")
            line2=$(sed -n '2p' "$f")
            line3=$(sed -n '3p' "$f")
            # Format detection (in order of specificity):
            #   cpw new: line1=[dir]  line2=# <ts>  line3=$ <cmd>
            #   cpw old: line1=[dir]  line2=$ <cmd>
            #   cpc -d : line1=# workdir:...  line2=<cmd>  (no [..] header)
            #   cpc    : line1=<cmd>
            ts=
            if [[ $line1 == \[*\] ]]; then
                dir=$line1
                if [[ $line2 == "# "* ]]; then
                    ts=${line2#\# }
                    cmd=$line3
                else
                    cmd=$line2
                fi
            else
                dir=
                cmd=$line1
            fi
            printf '%d\t%s\t%s\t%s\t%s\n' $i "$f" "${cmd:0:60}" "$dir" "$ts"
        done
    }

    # cph — interactive history picker. fzf with preview pane if available,
    # else falls back to a text list + hint to use 'cpr <N>'.
    # Tab in fzf: multi-select; Enter on multi-selection concatenates the
    # selected slots (blank-line separated, fzf's input order = newest first)
    # and copies the combined block — useful for handing a sequence of
    # command+output pairs to AI for analysis.
    cph() {
        [[ $1 == --help || $1 == -h ]] && { _cp_help; return }
        [[ -s $_CP_DIR/.idx ]] || { print "(empty)"; return 1 }

        if (( $+commands[fzf] )); then
            local selected
            # NOTE: fzf substitutes {n} with single-quoted values for shell
            # safety, so write `cat {2}` (no outer quotes) — `cat "{2}"` would
            # nest quotes and cat would receive a literal-quoted path.
            selected=$(_cp_slots | fzf \
                --multi \
                --delimiter=$'\t' \
                --with-nth='5,3,4' \
                --preview='cat {2}' \
                --header='Tab: multi-select  |  Enter: copy (concat if multi)  |  Esc: cancel')
            [[ -z $selected ]] && return

            local lines=("${(@f)selected}")
            local n=${#lines[@]}
            if (( n > 1 )); then
                # Multi-select: concat selected slot files (blank-line separated)
                local sep="" line f
                {
                    for line in $lines; do
                        [[ -z $sep ]] || print
                        sep=x
                        f="${${line#*$'\t'}%%$'\t'*}"
                        cat -- "$f"
                    done
                } | _cp_send
                print "✓ concat'd $n slots"
            else
                local back=${selected%%$'\t'*}
                cpr "$back"
            fi
        else
            _cp_slots | while IFS=$'\t' read -r i _ cmd dir ts; do
                if [[ -n $dir ]]; then
                    printf '  -%-2d %-19s %-50s  %s\n' $i "$ts" "${cmd:0:50}" "$dir"
                else
                    printf '  -%-2d %-19s %s\n' $i "$ts" "${cmd:0:60}"
                fi
            done
            print "  → fzf not found; use 'cpr <N>' to copy a slot"
        fi
    }
fi

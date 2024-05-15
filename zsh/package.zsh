#!/usr/bin/bash

FUNCTION_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/zsh/site-functions"

if (( $+commands[zoxide] )); then
    eval "$(zoxide init zsh)"
fi

if (( $+commands[navi] )); then
    # ref: https://github.com/denisidoro/navi/blob/master/shell/navi.plugin.zsh
    _navi_call() {
        local result="$(navi "$@" </dev/tty)"
        printf "%s" "$result"
    }

    _navi_widget() {
        local -r input="${LBUFFER}"
        local -r last_command="$(echo "${input}" | navi fn widget::last_command)"
        local replacement="$last_command"

        if [ -z "$last_command" ]; then
            replacement="$(_navi_call --print)"
        elif [ "$LASTWIDGET" = "_navi_widget" ] && [ "$input" = "$previous_output" ]; then
            replacement="$(_navi_call --print --query "$last_command")"
        else
            replacement="$(_navi_call --print --best-match --query "$last_command")"
        fi

        if [ -n "$replacement" ]; then
            local -r find="${last_command}_NAVIEND"
            previous_output="${input}_NAVIEND"
            previous_output="${previous_output//$find/$replacement}"
        else
            previous_output="$input"
        fi

        zle kill-whole-line
        LBUFFER="${previous_output}"
        region_highlight=("P0 100 bold")
        zle redisplay
    }

    zle -N _navi_widget
    bindkey '^g' _navi_widget
fi

if (( $+commands[thefuck] || $+commands[fuck] )); then
    znap function _fuck fuck 'eval $(thefuck --alias)'
    compdef _fuck fuck
fi

if (( $+commands[poetry] )) && [ ! -f $FUNCTION_DIR/_poetry ]; then
    znap fpath _poetry "poetry completions zsh"
    znap compile $FUNCTION_DIR
fi


if (( $+commands[asdf] )) && [ ! -f $ASDF_DIR/_asdf.zwc ]; then
    znap compile $ASDF_DIR/completions/_asdf
    znap compile $ASDF_DIR/completions/asdf.bash
fi
if (( $+commands[asdf] )); then
    fpath=( $fpath $ASDF_DIR/completions )
fi

if (( $+commands[croc] )) && [ ! -f $FUNCTION_DIR/_croc ]; then
    znap fpath _croc "curl https://raw.githubusercontent.com/schollz/croc/main/src/install/zsh_autocomplete"
fi
if (( $+commands[croc] )); then
    PROG=croc
    CLI_ZSH_AUTOCOMPLETE_HACK=1
    source $FUNCTION_DIR/_croc
fi


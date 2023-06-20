# Enable Powerlevel10k instant prompt. Should stay close to the top of ~/.zshrc.
# Initialization code that may require console input (password prompts, [y/n]
# confirmations, etc.) must go above this block; everything else may go below.
if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi

export ZSH_CUSTOM="$HOME/.zsh-plugins"
export ZSH_CONFIG="$ZSH_CUSTOM/.zsh-config"
# Znap init
[[ -r $ZSH_CUSTOM/znap/znap.zsh ]] ||
  git clone --depth 1 -- https://github.com/marlonrichert/zsh-snap.git $ZSH_CUSTOM/znap
source $ZSH_CUSTOM/znap/znap.zsh  # Start Znap

# `znap prompt` makes your prompt visible in just 15-40ms!
# `znap source` starts plugins.
# `znap eval` makes evaluating generated command output up to 10 times faster.
# `znap function` lets you lazy-load features you don't always need.
# `znap install` adds new commands and completions.
# ====================== plugins start =======================
#znap prompt sindresorhus/pure
znap prompt romkatv/powerlevel10k

znap source zsh-users/zsh-autosuggestions
znap source zsh-users/zsh-completions
znap source zsh-users/zsh-syntax-highlighting
znap source marlonrichert/zsh-hist # only need "expand-aliases"
znap source hlissner/zsh-autopair
znap source olets/zsh-window-title
znap source asdf-vm/asdf

# from oh-my-zsh
[[ ! -d $HOME/.zsh-plugins/ohmyzsh/ohmyzsh ]] && znap install ohmyzsh/ohmyzsh
znap source ohmyzsh/ohmyzsh lib/directories
znap source ohmyzsh/ohmyzsh plugins/aliases
znap source ohmyzsh/ohmyzsh plugins/command-not-found
znap source ohmyzsh/ohmyzsh plugins/common-aliases
znap source ohmyzsh/ohmyzsh plugins/cp
znap source ohmyzsh/ohmyzsh plugins/docker-compose
znap source ohmyzsh/ohmyzsh plugins/extract # command: extract
znap source ohmyzsh/ohmyzsh plugins/fzf
znap source Aloxaf/fzf-tab
znap source ohmyzsh/ohmyzsh plugins/git
znap source ohmyzsh/ohmyzsh plugins/globalias
znap source ohmyzsh/ohmyzsh plugins/sudo
znap source ohmyzsh/ohmyzsh plugins/systemadmin
znap source ohmyzsh/ohmyzsh plugins/systemd
znap source ohmyzsh/ohmyzsh plugins/tmux
znap source ohmyzsh/ohmyzsh plugins/universalarchive # command: ua
# ======================= plugins end ========================


# ======================= source start =======================
# To customize prompt, run `p10k configure` or edit ~/.p10k.zsh.
[[ ! -f $HOME/.p10k.zsh ]]          || source $HOME/.p10k.zsh
[[ ! -f $HOME/.zprofile ]]          || source $HOME/.zprofile
[[ ! -f $ZSH_CONFIG/.zsh_aliases ]] || source $ZSH_CONFIG/.zsh_aliases
[[ ! -f $ZSH_CONFIG/package.zsh ]]  || source $ZSH_CONFIG/package.zsh
# ======================== source end ========================


# ====================== setting start =======================
WORDCHARS='*?_-.[]~=&;!#$%^(){}<>'
# [Ctrl-RightArrow] - move forward one word
bindkey -M emacs '^[[1;5C' forward-word
bindkey -M viins '^[[1;5C' forward-word
bindkey -M vicmd '^[[1;5C' forward-word
# [Ctrl-LeftArrow] - move backward one word
bindkey -M emacs '^[[1;5D' backward-word
bindkey -M viins '^[[1;5D' backward-word
bindkey -M vicmd '^[[1;5D' backward-word

# environment variables
export GPG_TTY=$TTY # https://github.com/romkatv/powerlevel10k#how-do-i-export-gpg_tty-when-using-instant-prompt 
export EDITOR=nvim
export LANG=en_US.UTF-8

# history
# the detailed meaning of the below three variable can be found in `man zshparam`.
HISTFILE=~/.zsh_history
HISTSIZE=1200000000  # the number of items for the internal history list
SAVEHIST=1000000000  # maximum number of items for the history file
# The meaning of these options can be found in man page of `zshoptions`.
## History command configuration
setopt extended_history       # record timestamp of command in HISTFILE
setopt hist_expire_dups_first # delete duplicates first when HISTFILE size exceeds HISTSIZE
setopt hist_ignore_dups       # ignore duplicated commands history list
setopt hist_ignore_space      # ignore commands that start with space
setopt hist_verify            # show command with history expansion to user before running it
setopt share_history          # share command history data

# zsh-hist
zstyle ':hist:*' expand-aliases yes

znap fpath _ ':'
# ======================= setting end ========================

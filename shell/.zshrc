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
znap source hlissner/zsh-autopair
znap source olets/zsh-window-title

# from oh-my-zsh
znap install ohmyzsh/ohmyzsh
znap source ohmyzsh/ohmyzsh lib/directories
znap source ohmyzsh/ohmyzsh plugins/aliases
znap source ohmyzsh/ohmyzsh plugins/asdf
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
znap source ohmyzsh/ohmyzsh plugins/zoxide
# ======================= plugins end ========================


# ======================= source start =======================
# To customize prompt, run `p10k configure` or edit ~/.p10k.zsh.
[[ ! -f $HOME/.p10k.zsh ]]          || source $HOME/.p10k.zsh
[[ ! -f $HOME/.zprofile ]]          || source $HOME/.zprofile
[[ ! -f $ZSH_CONFIG/.zsh_aliases ]] || source $ZSH_CONFIG/.zsh_aliases
# ======================== source end ========================


# ====================== setting start =======================
[ ! -d "$ZSH_CUSTOM/.zfunc" ] && mkdir "$ZSH_CUSTOM/.zfunc"
fapth=($ZSH_CUSTOM/.zfunc $fpath)

# environment variables
export GPG_TTY=$TTY # https://github.com/romkatv/powerlevel10k#how-do-i-export-gpg_tty-when-using-instant-prompt 
export EDITOR=nvim
export LANG=en_US.UTF-8

# history
HISTFILE=~/.zsh_history
HISTSIZE=999999999
SAVEHIST=$HISTSIZE
setopt SHARE_HISTORY

# thefuck
eval $(thefuck --alias)
# ======================= setting end ========================

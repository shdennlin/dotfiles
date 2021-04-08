command_exists () {
    type "$1" &> /dev/null ;
}

# gdrive download
gdd () {
  CONFIRM=$(wget --quiet --save-cookies /tmp/cookies.txt --keep-session-cookies --no-check-certificate "https://docs.google.com/uc?export=download&id=$1" -O- | sed -rn 's/.*confirm=([0-9A-Za-z_]+).*/\1\n/p')
  wget --load-cookies /tmp/cookies.txt "https://docs.google.com/uc?export=download&confirm=$CONFIRM&id=$1" -O $2
  rm -rf /tmp/cookies.txt
}
# ============alias=============

if command_exists bpytop ; then
  alias top='bpytop'
fi

alias ca='conda activate'
alias catg='conda activate tf-gpu'

alias cl='clear'
alias ..='cd ..'
alias .2='cd ../..'
alias .3='cd ../../..'
alias .4='cd ../../../..'
alias .5='cd ../../../../..'
alias .6='cd ../../../../../..'
alias .7='cd ../../../../../../..'
alias .8='cd ../../../../../../../..'
alias .9='cd ../../../../../../../../..'

if command_exists xclip ; then
  alias c="xclip -selection clipboard"
  alias cn="tr -d '\n' | xclip -selection clipboard"
  alias pcn="pwd | tr -d '\n' | xclip -selection clipboard"
fi

alias dus="du -chd 1 | sort -h"

alias dk="docker"

# slove emacs Chinese display problem
alias emacs='env LC_CTYPE=zh_TW.UTF-8 emacs'

alias g='git'
alias gp='grep -Ei --color=always'
alias gd='gdrive'

alias l='ls --color=always'
alias ll='ls -lhF --color=always'
alias la='ls -AF --color=always'
alias lal='ls -lAhF --color=always'
alias lls='ls -lAhF --color=always | less -r'

alias lt='ls -t --color=always'
alias llt='ls -lhFt --color=always'
alias lat='ls -AFt --color=always'
alias lalt='ls -lAhFt --color=always'
alias llst='ls -lAhFt --color=always | less -r'

alias less='less -r'

alias lsofp='sudo lsof -i -P -n | grep LISTEN'

alias psgp='ps -ef | gp -E'

alias su='sudo'

alias k='kill'
alias k9='kill -9'
alias pk='pkill'
alias pk9='pkill -9'

alias rm='rm -rf'
alias rmv='rm -rfv'

alias vi='vim'
alias vib='vi ~/.dotfiles/.bash_aliases'
alias vig='vi ~/.dotfiles/.gitconfig'

# show git branch in terminal
export PS1='\[\033[01;32m\]\[\033[0m\033[0;32m\]\[\033[01;32m\]\u@\h\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]$(__git_ps1)$ '

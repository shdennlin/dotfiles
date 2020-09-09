command_exists () {
    type "$1" &> /dev/null ;
}

# gdrive download
gdd () {
  CONFIRM=$(wget --quiet --save-cookies /tmp/cookies.txt --keep-session-cookies --no-check-certificate "https://docs.google.com/uc?export=download&id=$1" -O- | sed -rn 's/.*confirm=([0-9A-Za-z_]+).*/\1\n/p')
  wget --load-cookies /tmp/cookies.txt "https://docs.google.com/uc?export=download&confirm=$CONFIRM&id=$1" -O $2
  rm -rf /tmp/cookies.txt
}

# show git branch in terminal
export PS1='\[\033[01;32m\]\[\033[0m\033[0;32m\]\[\033[01;32m\]\u@\h\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]$(__git_ps1)$ '
# ============alias=============

if command_exists bpytop ; then
  alias top='bpytop'
fi

alias ca='conda activate'
alias catg='conda activate tf-gpu'

alias cl='clear'
alias ..='cd ..'
alias ...='cd ../..'
alias ....='cd ../../..'
alias .....='cd ../../../..'
alias ......='cd ../../../../..'

if command_exists xclip ; then
  alias c="xclip -selection clipboard"
  alias cn="tr -d '\n' | xclip -selection clipboard"
  alias pcn="pwd | tr -d '\n' | xclip -selection clipboard"
fi

alias dus="du -chd 1 | sort -h"

# slove emacs Chinese display problem
alias emacs='env LC_CTYPE=zh_CN.UTF-8 emacs'

alias g='git'
alias gp='grep -E --color=always'
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

alias psgp='ps -ef | gp -E'

alias k='kill'
alias k9='kill -9'
alias pk='pkill'
alias pk9='pkill -9'

alias vi='vim'
alias vbb='vi ~/.dotfiles/.bash_aliases'
alias vgg='vi ~/.dotfiles/.gitconfig'

# ============ path =============
export PATH=$PATH:/usr/local/go/bin
export GOBIN=$GOPATH/bin

#!/bin/sh

cd $HOME
rm -rf .git-webui 2>&1 > /dev/null
mkdir .git-webui
cd .git-webui
git archive --format=tar.bz2 --remote git@bitbucket.org:alberthier/git-webui.git HEAD src | tar -x --strip-components=1
git config --global --add alias.webui "!$HOME/.git-webui/lib/git-core/git-webui"

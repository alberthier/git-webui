#!/bin/sh

# Copyright 2015 Eric ALBER
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

if [ "$OS" = "Windows_NT" ]; then
    # We are on windows, check if Python is installed
    python -V > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        PYTHON=python
    else
        reg query "HKLM\SOFTWARE\Python\PythonCore" > /dev/null 2>&1
        if [ $? -ne 0 ]; then
            echo "Please install Python first"
            echo "You can download it from http://python.org/downloads/"
            exit 1
        fi
        PYTHON_REG_PATH=`reg query "HKLM\SOFTWARE\Python\PythonCore" | grep HKEY | sort | tail -n 1`
        PYTHON_ROOT=/`reg query "${PYTHON_REG_PATH}\InstallPath" -ve | grep REG_SZ | sed -e "s/.*REG_SZ\s\+\(.*\)/\1/" | sed -e "s/://" | sed -e "s/\\\\\/\//g"`
        PYTHON=${PYTHON_ROOT}python.exe
    fi
fi

cd $HOME
rm -rf .git-webui > /dev/null 2>&1
echo "Cloning git-webui repository"
git clone --depth 1 https://github.com/alberthier/git-webui.git .git-webui
echo "Enabling auto update"
git config --global --replace-all webui.autoupdate true
echo "Installing 'webui' alias"
if [ "$OS" = "Windows_NT" ]; then
    git config --global --replace-all alias.webui "!${PYTHON} $HOME/.git-webui/release/libexec/git-core/git-webui"
else
    git config --global --replace-all alias.webui !$HOME/.git-webui/release/libexec/git-core/git-webui
fi

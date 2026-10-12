#!/bin/bash
# usage: render.sh name height
google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1440,$2 --screenshot=/workspace/casepilot-ds/mockups/$1.png file://$PWD/$1.html 2>/dev/null >/dev/null

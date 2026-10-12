#!/bin/bash
google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size=375,$2 --screenshot=/workspace/casepilot-ds/mockups/$1-375.png file://$PWD/$1.html 2>/dev/null >/dev/null

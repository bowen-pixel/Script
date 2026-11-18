#!/bin/zsh
set -e
cd -- "${0:A:h}"
# This installer is run from Terminal once. The installed app pins these runtimes.
if ! command -v node >/dev/null 2>&1; then
  print "Node.js 22+ is required. Install it, reopen Terminal, then try again."
  read "?Press Return to close. "
  exit 1
fi
node InstallLauncher.mjs
print "Installed. Open Discord Themes in your personal Applications folder."
read "?Press Return to close. "

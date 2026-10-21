#!/usr/bin/env bash

CACHE="$HOME/goinfre/.cache"

mkdir -p "$CACHE"

if [ ! -L "$HOME/.cache" ]; then
    cp -a "$HOME/.cache/." "$CACHE/" 2>/dev/null
    rm -rf "$HOME/.cache"
    ln -s "$CACHE" "$HOME/.cache"
fi

echo "export XDG_CACHE_HOME=$CACHE" >> "$HOME/.zshrc"

echo "Done. Restart your terminal or run:"
echo "source ~/.zshrc"

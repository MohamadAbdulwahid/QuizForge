#!/usr/bin/env bash
# Thin wrapper that delegates to the task-management skill in ~/.config/opencode
exec bash /home/mohamad/.config/opencode/skills/task-management/router.sh "$@"

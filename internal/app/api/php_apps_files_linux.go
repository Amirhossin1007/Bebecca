//go:build linux

package api

import (
	"os"
	"syscall"
)

func phpAppFileHasMultipleLinks(info os.FileInfo) bool {
	stat, ok := info.Sys().(*syscall.Stat_t)
	return !ok || stat.Nlink != 1
}

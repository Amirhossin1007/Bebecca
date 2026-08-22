//go:build !linux

package api

import "os"

func phpAppFileHasMultipleLinks(os.FileInfo) bool {
	return false
}

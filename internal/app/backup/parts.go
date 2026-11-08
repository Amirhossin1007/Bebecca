package backup

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

var partNamePattern = regexp.MustCompile(`^(.+)\.part(\d+)-of-(\d+)(\.[^.]+)$`)

type PartFile struct {
	Name string
	Path string
}

type partInfo struct {
	file  PartFile
	base  string
	ext   string
	index int
	total int
}

func IsPartName(name string) bool {
	_, ok := parsePartName(name)
	return ok
}

func parsePartName(name string) (partInfo, bool) {
	match := partNamePattern.FindStringSubmatch(filepath.Base(name))
	if match == nil {
		return partInfo{}, false
	}
	index, errIndex := strconv.Atoi(match[2])
	total, errTotal := strconv.Atoi(match[3])
	if errIndex != nil || errTotal != nil || index < 1 || total < 1 || index > total {
		return partInfo{}, false
	}
	return partInfo{base: match[1], ext: match[4], index: index, total: total}, true
}

func (s *Service) ImportUploads(ctx context.Context, files []PartFile) (ImportResult, error) {
	if len(files) == 0 {
		return ImportResult{}, Error{Message: "Backup file not found"}
	}
	if len(files) == 1 && !IsPartName(files[0].Name) {
		return s.Import(ctx, files[0].Path)
	}
	assembled, err := os.CreateTemp("", "rebecca-backup-assembled-*"+Extension)
	if err != nil {
		return ImportResult{}, err
	}
	assembledPath := assembled.Name()
	_ = assembled.Close()
	defer os.Remove(assembledPath)
	if err := AssemblePartFiles(files, assembledPath); err != nil {
		return ImportResult{}, err
	}
	return s.Import(ctx, assembledPath)
}

func AssemblePartFiles(files []PartFile, destination string) error {
	parts := make([]partInfo, 0, len(files))
	for _, file := range files {
		part, ok := parsePartName(file.Name)
		if !ok {
			return Error{Message: fmt.Sprintf("%s is not a backup part; upload all parts of one backup together", file.Name)}
		}
		part.file = file
		parts = append(parts, part)
	}
	first := parts[0]
	seen := make(map[int]bool, len(parts))
	for _, part := range parts {
		if part.base != first.base || part.ext != first.ext || part.total != first.total {
			return Error{Message: "The selected files do not belong to the same backup"}
		}
		if seen[part.index] {
			return Error{Message: fmt.Sprintf("Backup part %d of %d was selected more than once", part.index, part.total)}
		}
		seen[part.index] = true
	}
	var missing []string
	for index := 1; index <= first.total; index++ {
		if !seen[index] {
			missing = append(missing, strconv.Itoa(index))
		}
	}
	if len(missing) > 0 {
		return Error{Message: "Missing backup part(s): " + strings.Join(missing, ", ")}
	}
	sort.Slice(parts, func(i, j int) bool { return parts[i].index < parts[j].index })

	sizes := make([]int64, len(parts))
	for i, part := range parts {
		info, err := os.Stat(part.file.Path)
		if err != nil {
			return err
		}
		sizes[i] = info.Size()
	}
	for i := 0; i < len(sizes)-1; i++ {
		if sizes[i] != sizes[0] {
			return Error{Message: fmt.Sprintf("Backup part %d of %d has an unexpected size", i+1, first.total)}
		}
	}
	last := sizes[len(sizes)-1]
	if last <= 0 || last > sizes[0] {
		return Error{Message: fmt.Sprintf("Backup part %d of %d has an unexpected size", len(sizes), first.total)}
	}

	out, err := os.Create(destination)
	if err != nil {
		return err
	}
	for _, part := range parts {
		if err := appendFile(out, part.file.Path); err != nil {
			_ = out.Close()
			return err
		}
	}
	return out.Close()
}

func appendFile(out io.Writer, source string) error {
	in, err := os.Open(source)
	if err != nil {
		return err
	}
	defer in.Close()
	_, err = io.Copy(out, in)
	return err
}

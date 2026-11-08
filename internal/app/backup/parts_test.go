package backup

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeTestParts(t *testing.T, payload []byte, size int) []PartFile {
	t.Helper()
	dir := t.TempDir()
	total := (len(payload) + size - 1) / size
	files := make([]PartFile, 0, total)
	for index := 1; index <= total; index++ {
		start := (index - 1) * size
		end := min(start+size, len(payload))
		name := fmt.Sprintf("rebecca-database-20261019.part%02d-of-%02d.rbbackup", index, total)
		path := filepath.Join(dir, name)
		if err := os.WriteFile(path, payload[start:end], 0o600); err != nil {
			t.Fatal(err)
		}
		files = append(files, PartFile{Name: name, Path: path})
	}
	return files
}

func TestAssemblePartFilesRebuildsArchiveInPartOrder(t *testing.T) {
	payload := bytes.Repeat([]byte("rebecca"), 300)
	files := writeTestParts(t, payload, 1000)
	reversed := make([]PartFile, len(files))
	for i, file := range files {
		reversed[len(files)-1-i] = file
	}
	destination := filepath.Join(t.TempDir(), "assembled.rbbackup")
	if err := AssemblePartFiles(reversed, destination); err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(destination)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, payload) {
		t.Fatalf("assembled %d bytes, want %d", len(got), len(payload))
	}
}

func TestAssemblePartFilesRejectsMissingAndDamagedParts(t *testing.T) {
	payload := bytes.Repeat([]byte("rebecca"), 300)
	files := writeTestParts(t, payload, 1000)
	destination := filepath.Join(t.TempDir(), "assembled.rbbackup")

	withoutSecond := []PartFile{files[0], files[2]}
	err := AssemblePartFiles(withoutSecond, destination)
	if err == nil || !strings.Contains(err.Error(), "Missing backup part(s): 2") {
		t.Fatalf("missing part error = %v", err)
	}

	if err := os.Truncate(files[0].Path, 999); err != nil {
		t.Fatal(err)
	}
	err = AssemblePartFiles(files, destination)
	if err == nil || !strings.Contains(err.Error(), "unexpected size") {
		t.Fatalf("damaged part error = %v", err)
	}
}

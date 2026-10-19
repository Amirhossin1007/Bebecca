package api

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestSaveBackupUploadsKeepsEveryPartFile(t *testing.T) {
	names := []string{
		"rebecca-database-20261019.part01-of-02.rbbackup",
		"rebecca-database-20261019.part02-of-02.rbbackup",
	}
	contents := []string{"first", "second"}
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	for i, name := range names {
		field, err := writer.CreateFormFile("file", name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := field.Write([]byte(contents[i])); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/settings/backup/import", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	uploads, cleanup, err := saveBackupUploads(httptest.NewRecorder(), req)
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup()
	if len(uploads) != len(names) {
		t.Fatalf("uploads = %d, want %d", len(uploads), len(names))
	}
	for i := range names {
		if uploads[i].Name != names[i] {
			t.Fatalf("upload %d name = %q", i, uploads[i].Name)
		}
		content, err := os.ReadFile(uploads[i].Path)
		if err != nil {
			t.Fatal(err)
		}
		if string(content) != contents[i] {
			t.Fatalf("upload %d content = %q", i, content)
		}
	}
}

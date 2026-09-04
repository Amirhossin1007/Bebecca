package searchmatch

import (
	"context"
	"database/sql"
	"reflect"
	"testing"

	_ "modernc.org/sqlite"
)

func TestSQLAnyMatchModes(t *testing.T) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.Exec(`CREATE TABLE items (value TEXT); INSERT INTO items VALUES ('Alpha-beta'), ('alphabet'), ('alpha_beta')`); err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name    string
		query   string
		options Options
		want    []string
	}{
		{name: "default", query: "alpha", want: []string{"Alpha-beta", "alphabet", "alpha_beta"}},
		{name: "case", query: "Alpha", options: Options{MatchCase: true}, want: []string{"Alpha-beta"}},
		{name: "whole", query: "alpha", options: Options{MatchWholeWord: true}, want: []string{"Alpha-beta"}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			predicate, args := SQLAny("sqlite", []string{"value"}, test.query, test.options)
			rows, err := db.QueryContext(context.Background(), "SELECT value FROM items WHERE "+predicate+" ORDER BY rowid", args...)
			if err != nil {
				t.Fatal(err)
			}
			defer rows.Close()
			var got []string
			for rows.Next() {
				var value string
				if err := rows.Scan(&value); err != nil {
					t.Fatal(err)
				}
				got = append(got, value)
			}
			if !reflect.DeepEqual(got, test.want) {
				t.Fatalf("got %v, want %v", got, test.want)
			}
		})
	}
}

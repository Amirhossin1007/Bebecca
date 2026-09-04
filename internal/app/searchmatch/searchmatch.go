package searchmatch

import (
	"fmt"
	"strings"
	"unicode"
)

type Options struct {
	MatchCase      bool
	MatchWholeWord bool
}

func SQLAny(dialect string, expressions []string, query string, options Options) (string, []any) {
	query = strings.TrimSpace(query)
	if query == "" || len(expressions) == 0 {
		return "1 = 1", nil
	}
	expression := joinExpressions(dialect, expressions)
	needle := query
	if options.MatchWholeWord {
		expression = normalizeWordsSQL(expression)
		needle = normalizeWords(query)
		if needle == "" {
			return "1 = 0", nil
		}
		if isMySQL(dialect) {
			expression = "CONCAT(' ', " + expression + ", ' ')"
		} else {
			expression = "(' ' || " + expression + " || ' ')"
		}
		needle = " " + needle + " "
	}
	if !options.MatchCase {
		expression = "LOWER(" + expression + ")"
		needle = strings.ToLower(needle)
	}
	if options.MatchCase && isMySQL(dialect) {
		return "INSTR(CAST(" + expression + " AS BINARY), CAST(? AS BINARY)) > 0", []any{needle}
	}
	return "INSTR(" + expression + ", ?) > 0", []any{needle}
}

func joinExpressions(dialect string, expressions []string) string {
	values := make([]string, 0, len(expressions))
	for _, expression := range expressions {
		values = append(values, "COALESCE("+expression+", '')")
	}
	if isMySQL(dialect) {
		return "CONCAT_WS(' ', " + strings.Join(values, ", ") + ")"
	}
	return strings.Join(values, " || ' ' || ")
}

func normalizeWordsSQL(expression string) string {
	for _, separator := range []int{9, 10, 13, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 58, 59, 60, 61, 62, 63, 64, 91, 92, 93, 94, 96, 123, 124, 125, 126} {
		expression = fmt.Sprintf("REPLACE(%s, CHAR(%d), ' ')", expression, separator)
	}
	for range 4 {
		expression = "REPLACE(" + expression + ", '  ', ' ')"
	}
	return expression
}

func normalizeWords(value string) string {
	var result strings.Builder
	space := true
	for _, char := range value {
		if unicode.IsLetter(char) || unicode.IsNumber(char) || char == '_' {
			result.WriteRune(char)
			space = false
			continue
		}
		if !space {
			result.WriteByte(' ')
			space = true
		}
	}
	return strings.TrimSpace(result.String())
}

func isMySQL(dialect string) bool {
	dialect = strings.ToLower(strings.TrimSpace(dialect))
	return dialect == "mysql" || dialect == "mariadb"
}

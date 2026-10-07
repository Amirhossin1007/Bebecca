package logging

import (
	"fmt"
	"log"
	"os"
	"strings"
	"sync"
	"time"
)

type Diagnostic struct {
	Component string
	Level     Level
	Message   string
	Time      time.Time
}

var recentDiagnostics = struct {
	sync.Mutex
	items []Diagnostic
}{}

// RecentDiagnostics is a bounded, in-memory view of recent warnings/errors,
// not an active-fault list. Resolved failures age out after 15 minutes.
func RecentDiagnostics() []Diagnostic {
	recentDiagnostics.Lock()
	defer recentDiagnostics.Unlock()
	result := []Diagnostic{}
	for _, item := range recentDiagnostics.items {
		if time.Since(item.Time) <= 15*time.Minute {
			result = append(result, item)
		}
	}
	return result
}

type Level int

const (
	LevelDebug Level = iota
	LevelInfo
	LevelWarn
	LevelError
)

const (
	ComponentAdmin    = "Admin"
	ComponentDatabase = "Database"
	ComponentNode     = "Node"
	ComponentRuntime  = "Runtime"
	ComponentTelegram = "Telegram"
	ComponentUser     = "User"
	ComponentWebhook  = "Webhook"
)

func init() {
	log.SetFlags(0)
}

func Debugf(component string, format string, args ...any) {
	output(LevelDebug, component, format, args...)
}

func Infof(component string, format string, args ...any) {
	output(LevelInfo, component, format, args...)
}

func Warnf(component string, format string, args ...any) {
	output(LevelWarn, component, format, args...)
}

func Errorf(component string, format string, args ...any) {
	output(LevelError, component, format, args...)
}

func Fatalf(component string, format string, args ...any) {
	output(LevelError, component, format, args...)
	os.Exit(1)
}

func output(level Level, component string, format string, args ...any) {
	if level < configuredLevel() {
		return
	}
	component = strings.TrimSpace(component)
	if component == "" {
		component = "Runtime"
	}
	message := fmt.Sprintf(format, args...)
	if level >= LevelWarn {
		diagnostic := Diagnostic{component, level, message, time.Now().UTC()}
		if len(message) > 8192 {
			diagnostic.Message = strings.Clone(message[:8192]) + "…"
		}
		recentDiagnostics.Lock()
		items := []Diagnostic{diagnostic}
		for _, item := range recentDiagnostics.items {
			if len(items) >= 50 {
				break
			}
			if item.Component != component || item.Level != level || item.Message != diagnostic.Message {
				items = append(items, item)
			}
		}
		recentDiagnostics.items = items
		recentDiagnostics.Unlock()
	}
	_ = log.Output(3, fmt.Sprintf("[%s] %s %s", component, levelLabel(level), message))
}

func configuredLevel() Level {
	value := strings.ToLower(strings.TrimSpace(firstEnv("REBECCA_LOG_LEVEL", "REBECCA_LOG_MODE", "LOG_LEVEL")))
	if value == "" && truthy(firstEnv("REBECCA_DEBUG", "DEBUG")) {
		value = "debug"
	}
	switch value {
	case "debug", "trace":
		return LevelDebug
	case "warn", "warning":
		return LevelWarn
	case "error":
		return LevelError
	default:
		return LevelInfo
	}
}

func levelLabel(level Level) string {
	switch level {
	case LevelDebug:
		return "DEBUG"
	case LevelWarn:
		return "WARN"
	case LevelError:
		return "ERROR"
	default:
		return "INFO"
	}
}

func firstEnv(keys ...string) string {
	for _, key := range keys {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return value
		}
	}
	return ""
}

func truthy(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "on", "debug":
		return true
	default:
		return false
	}
}

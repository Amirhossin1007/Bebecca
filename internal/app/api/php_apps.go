package api

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	certificateapp "github.com/rebeccapanel/rebecca/internal/app/certificates"
)

const (
	defaultPHPAppsBase     = "/var/lib/rebecca/php-apps"
	mirzaBotVersion        = "0.3.2"
	mirzaBotSourceSHA      = "55c82c686e0ca6b46fffa878e5a8c51e894e7516"
	mirzaBotArchiveURL     = "https://codeload.github.com/mahdiMGF2/mirzabot/zip/55c82c686e0ca6b46fffa878e5a8c51e894e7516"
	mirzaBotArchiveSHA256  = "24da8308c64745402d7e9347297cbd57c39fbf8290d39a5bc85ab199cf2a79fc"
	maxPHPAppArchiveBytes  = 32 << 20
	maxPHPAppExtractedSize = 256 << 20
	maxPHPAppFiles         = 5000
)

var (
	errPHPAppBusy        = errors.New("another PHP application operation is already running")
	errPHPAppExists      = errors.New("an application already uses this domain")
	errPHPAppNotFound    = errors.New("PHP application not found")
	errPHPAppUnsupported = errors.New("PHP application hosting is not supported by this installation")
	mirzaBotTokenPattern = regexp.MustCompile(`^[0-9]{5,16}:[A-Za-z0-9_-]{20,100}$`)
	telegramIDPattern    = regexp.MustCompile(`^-?[0-9]{5,20}$`)
)

type phpAppInstallRequest struct {
	Domain   string `json:"domain"`
	BotToken string `json:"bot_token"`
	AdminID  string `json:"admin_id"`
}

type phpAppRecord struct {
	Template     string `json:"template"`
	Name         string `json:"name"`
	Domain       string `json:"domain"`
	Enabled      bool   `json:"enabled"`
	Runtime      string `json:"runtime"`
	Version      string `json:"version,omitempty"`
	SourceSHA    string `json:"source_sha,omitempty"`
	InstalledAt  string `json:"installed_at"`
	PHPVersion   string `json:"php_version,omitempty"`
	BotUsername  string `json:"bot_username,omitempty"`
	Root         string `json:"root"`
	Socket       string `json:"socket,omitempty"`
	PoolConfig   string `json:"pool_config,omitempty"`
	CronConfig   string `json:"cron_config,omitempty"`
	Service      string `json:"service,omitempty"`
	SystemUser   string `json:"system_user,omitempty"`
	Database     string `json:"database,omitempty"`
	DatabaseUser string `json:"database_user,omitempty"`
}

type phpAppPublicRecord struct {
	Template    string `json:"template"`
	Name        string `json:"name"`
	Domain      string `json:"domain"`
	Enabled     bool   `json:"enabled"`
	Runtime     string `json:"runtime"`
	Version     string `json:"version,omitempty"`
	SourceSHA   string `json:"source_sha,omitempty"`
	InstalledAt string `json:"installed_at"`
	PHPVersion  string `json:"php_version,omitempty"`
	BotUsername string `json:"bot_username,omitempty"`
	PublicURL   string `json:"public_url"`
}

type phpAppSecrets struct {
	BotToken      string `json:"bot_token,omitempty"`
	WebhookSecret string `json:"webhook_secret,omitempty"`
	CronSecret    string `json:"cron_secret,omitempty"`
}

type phpAppManager struct {
	baseDir      string
	databaseURL  string
	certificates *certificateapp.Manager
	httpClient   *http.Client

	operationMu sync.Mutex
	mu          sync.RWMutex
	apps        map[string]phpAppRecord
}

func newPHPAppManager(cfg Config, certificates *certificateapp.Manager) *phpAppManager {
	baseDir := strings.TrimSpace(cfg.PHPAppsBase)
	if baseDir == "" {
		baseDir = defaultPHPAppsBase
	}
	manager := &phpAppManager{
		baseDir:      filepath.Clean(baseDir),
		databaseURL:  cfg.Database,
		certificates: certificates,
		httpClient: &http.Client{
			Timeout: 2 * time.Minute,
			CheckRedirect: func(request *http.Request, via []*http.Request) error {
				if len(via) >= 5 {
					return errors.New("too many redirects")
				}
				switch strings.ToLower(request.URL.Hostname()) {
				case "codeload.github.com", "github.com", "objects.githubusercontent.com", "api.telegram.org":
					return nil
				default:
					return errors.New("unexpected redirect host")
				}
			},
		},
		apps: map[string]phpAppRecord{},
	}
	manager.reload()
	return manager
}

func (m *phpAppManager) reload() {
	entries, err := os.ReadDir(m.metadataDir())
	if err != nil {
		return
	}
	loaded := map[string]phpAppRecord{}
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(m.metadataDir(), entry.Name()))
		if err != nil {
			continue
		}
		var record phpAppRecord
		if json.Unmarshal(data, &record) != nil || (record.Template != "archive" && record.Template != "mirzabot") {
			continue
		}
		domain := canonicalPHPAppHost(record.Domain)
		if domain == "" || !pathWithin(m.appsDir(), record.Root) {
			continue
		}
		if record.Runtime == "php" && (!pathWithin("/run/php", record.Socket) || !pathWithin("/etc/php", record.PoolConfig)) {
			continue
		}
		if record.CronConfig != "" && !pathWithin("/etc/cron.d", record.CronConfig) {
			continue
		}
		record.Domain = domain
		loaded[domain] = record
	}
	m.mu.Lock()
	m.apps = loaded
	m.mu.Unlock()
}

func (m *phpAppManager) lookup(host string) (phpAppRecord, bool) {
	host = canonicalPHPAppHost(host)
	m.mu.RLock()
	record, ok := m.apps[host]
	m.mu.RUnlock()
	return record, ok
}

func (m *phpAppManager) setRecord(record phpAppRecord) {
	m.mu.Lock()
	m.apps[record.Domain] = record
	m.mu.Unlock()
}

func (m *phpAppManager) removeRecord(domain string) {
	m.mu.Lock()
	delete(m.apps, domain)
	m.mu.Unlock()
}

func (m *phpAppManager) publicRecords() []phpAppPublicRecord {
	m.mu.RLock()
	records := make([]phpAppPublicRecord, 0, len(m.apps))
	for _, record := range m.apps {
		records = append(records, publicPHPAppRecord(record))
	}
	m.mu.RUnlock()
	sort.Slice(records, func(i, j int) bool { return records[i].Domain < records[j].Domain })
	return records
}

func publicPHPAppRecord(record phpAppRecord) phpAppPublicRecord {
	return phpAppPublicRecord{
		Template:    record.Template,
		Name:        record.Name,
		Domain:      record.Domain,
		Enabled:     record.Enabled,
		Runtime:     record.Runtime,
		Version:     record.Version,
		SourceSHA:   record.SourceSHA,
		InstalledAt: record.InstalledAt,
		PHPVersion:  record.PHPVersion,
		BotUsername: record.BotUsername,
		PublicURL:   "https://" + record.Domain + "/",
	}
}

func (m *phpAppManager) hostingSupported() (bool, string) {
	mode, err := os.ReadFile("/opt/rebecca/.install-mode")
	if err != nil || strings.TrimSpace(string(mode)) != "binary" {
		return false, "PHP application hosting is available only in binary installations."
	}
	return true, ""
}

func (m *phpAppManager) mirzaSupported() (bool, string) {
	if ok, detail := m.hostingSupported(); !ok {
		return false, detail
	}
	credentials, err := parsePHPMyAdminCredentials(m.databaseURL)
	if err != nil || !isLocalDatabaseHost(credentials.Host) || credentials.Port != "3306" {
		return false, "MirzaBot requires Rebecca to use the local MySQL or MariaDB service on port 3306."
	}
	return true, ""
}

func (m *phpAppManager) certificateDomain(ctx context.Context, requested string) (string, error) {
	if m.certificates == nil {
		return "", errors.New("SSL manager is unavailable")
	}
	requested = canonicalPHPAppHost(requested)
	records, err := m.certificates.List(ctx)
	if err != nil {
		return "", fmt.Errorf("a managed SSL certificate is required for this domain: %w", err)
	}
	found := false
	for _, record := range records {
		if !phpAppCertificateContains(record, requested) {
			continue
		}
		found = true
		if (record.Status == "active" || record.Status == "expiring") && record.ServeTLS {
			return requested, nil
		}
	}
	if found {
		return "", errors.New("select an active managed certificate that is enabled for SNI serving")
	}
	return "", errors.New("a managed SSL certificate is required for this domain")
}

func phpAppCertificateContains(record certificateapp.Record, domain string) bool {
	if strings.EqualFold(record.Domain, domain) {
		return true
	}
	for _, name := range record.AltNames {
		if strings.EqualFold(name, domain) {
			return true
		}
	}
	return false
}

func (m *phpAppManager) installArchive(ctx context.Context, domain, name string, archive []byte) (phpAppPublicRecord, error) {
	if !m.operationMu.TryLock() {
		return phpAppPublicRecord{}, errPHPAppBusy
	}
	defer m.operationMu.Unlock()
	if ok, detail := m.hostingSupported(); !ok {
		return phpAppPublicRecord{}, fmt.Errorf("%w: %s", errPHPAppUnsupported, detail)
	}
	domain, err := m.certificateDomain(ctx, domain)
	if err != nil {
		return phpAppPublicRecord{}, err
	}
	if _, exists := m.lookup(domain); exists {
		return phpAppPublicRecord{}, errPHPAppExists
	}
	if len(archive) == 0 || len(archive) > maxPHPAppArchiveBytes {
		return phpAppPublicRecord{}, errors.New("ZIP archive is empty or exceeds 32 MiB")
	}
	if err := m.prepareStorage(); err != nil {
		return phpAppPublicRecord{}, err
	}
	stage, err := os.MkdirTemp(m.baseDir, ".archive-install-")
	if err != nil {
		return phpAppPublicRecord{}, err
	}
	defer os.RemoveAll(stage)
	root, err := extractPHPAppArchive(archive, stage)
	if err != nil {
		return phpAppPublicRecord{}, err
	}
	runtime, err := detectPHPAppRuntime(root)
	if err != nil {
		return phpAppPublicRecord{}, err
	}

	suffix := domainHash(domain)
	appRoot := filepath.Join(m.appsDir(), suffix)
	if _, err := os.Stat(appRoot); err == nil {
		return phpAppPublicRecord{}, errPHPAppExists
	} else if !os.IsNotExist(err) {
		return phpAppPublicRecord{}, err
	}
	record := phpAppRecord{
		Template:    "archive",
		Name:        normalizePHPAppName(name, domain),
		Domain:      domain,
		Enabled:     true,
		Runtime:     runtime,
		SourceSHA:   sha256Hex(archive),
		InstalledAt: time.Now().UTC().Format(time.RFC3339),
		Root:        appRoot,
	}

	var userCreated, appCreated, poolCreated bool
	completed := false
	defer func() {
		if completed {
			return
		}
		_ = os.Remove(m.recordPath(suffix))
		if poolCreated {
			_ = os.Remove(record.PoolConfig)
			_, _ = runPHPAppCommand(context.Background(), time.Minute, "systemctl", "reload", record.Service)
		}
		if appCreated {
			_ = os.RemoveAll(appRoot)
		}
		if userCreated {
			_, _ = runPHPAppCommand(context.Background(), time.Minute, "userdel", record.SystemUser)
		}
	}()

	if runtime == "php" {
		if err := preparePHPAppHost(ctx); err != nil {
			return phpAppPublicRecord{}, err
		}
		phpVersion, err := activePHPVersion(ctx, false)
		if err != nil {
			return phpAppPublicRecord{}, err
		}
		record.PHPVersion = phpVersion
		record.SystemUser = "rbphp_" + suffix
		record.Socket = filepath.Join("/run/php", "rebecca-"+suffix+".sock")
		record.PoolConfig = filepath.Join("/etc/php", phpVersion, "fpm", "pool.d", "rebecca-"+suffix+".conf")
		record.Service = "php" + phpVersion + "-fpm"
		if err := ensurePHPAppRuntimeFree(ctx, record); err != nil {
			return phpAppPublicRecord{}, err
		}
		if _, err := runPHPAppCommand(ctx, time.Minute, "useradd", "--system", "--user-group", "--home-dir", appRoot, "--shell", "/usr/sbin/nologin", "--no-create-home", record.SystemUser); err != nil {
			return phpAppPublicRecord{}, fmt.Errorf("create isolated PHP user: %w", err)
		}
		userCreated = true
	}
	if err := os.Rename(root, appRoot); err != nil {
		return phpAppPublicRecord{}, fmt.Errorf("install application files: %w", err)
	}
	appCreated = true
	if runtime == "php" {
		uid, gid, err := unixUserIDs(ctx, record.SystemUser)
		if err != nil {
			return phpAppPublicRecord{}, err
		}
		if err := prepareOwnedPHPAppTree(appRoot, uid, gid); err != nil {
			return phpAppPublicRecord{}, err
		}
		if err := writePHPAppPool(record, false); err != nil {
			return phpAppPublicRecord{}, err
		}
		poolCreated = true
		if err := reloadPHPFPM(ctx, record); err != nil {
			return phpAppPublicRecord{}, err
		}
	} else if err := makeStaticTreeReadOnly(appRoot); err != nil {
		return phpAppPublicRecord{}, err
	}
	if err := m.writeRecord(record); err != nil {
		return phpAppPublicRecord{}, err
	}
	m.setRecord(record)
	completed = true
	return publicPHPAppRecord(record), nil
}

func (m *phpAppManager) installMirzaBot(ctx context.Context, request phpAppInstallRequest) (phpAppPublicRecord, error) {
	if !m.operationMu.TryLock() {
		return phpAppPublicRecord{}, errPHPAppBusy
	}
	defer m.operationMu.Unlock()
	request.Domain = strings.TrimSpace(request.Domain)
	request.BotToken = strings.TrimSpace(request.BotToken)
	request.AdminID = strings.TrimSpace(request.AdminID)
	if !mirzaBotTokenPattern.MatchString(request.BotToken) || !telegramIDPattern.MatchString(request.AdminID) {
		return phpAppPublicRecord{}, errors.New("a valid Telegram bot token and Telegram admin ID are required")
	}
	if ok, detail := m.mirzaSupported(); !ok {
		return phpAppPublicRecord{}, fmt.Errorf("%w: %s", errPHPAppUnsupported, detail)
	}
	domain, err := m.certificateDomain(ctx, request.Domain)
	if err != nil {
		return phpAppPublicRecord{}, err
	}
	if _, exists := m.lookup(domain); exists {
		return phpAppPublicRecord{}, errPHPAppExists
	}
	if err := m.ensureBotTokenAvailable(request.BotToken); err != nil {
		return phpAppPublicRecord{}, err
	}
	if err := preparePHPAppHost(ctx); err != nil {
		return phpAppPublicRecord{}, err
	}
	phpVersion, err := activePHPVersion(ctx, true)
	if err != nil {
		return phpAppPublicRecord{}, err
	}
	botUsername, err := m.telegramBotUsername(ctx, request.BotToken)
	if err != nil {
		return phpAppPublicRecord{}, err
	}
	archive, err := m.downloadMirzaBot(ctx)
	if err != nil {
		return phpAppPublicRecord{}, err
	}
	if err := m.prepareStorage(); err != nil {
		return phpAppPublicRecord{}, err
	}
	stage, err := os.MkdirTemp(m.baseDir, ".mirzabot-install-")
	if err != nil {
		return phpAppPublicRecord{}, err
	}
	defer os.RemoveAll(stage)
	sourceRoot, err := extractMirzaBotArchive(archive, stage)
	if err != nil {
		return phpAppPublicRecord{}, err
	}

	suffix := domainHash(domain)
	record := phpAppRecord{
		Template:     "mirzabot",
		Name:         "MirzaBot @" + botUsername,
		Domain:       domain,
		Enabled:      false,
		Runtime:      "php",
		Version:      mirzaBotVersion,
		SourceSHA:    mirzaBotSourceSHA,
		InstalledAt:  time.Now().UTC().Format(time.RFC3339),
		PHPVersion:   phpVersion,
		BotUsername:  botUsername,
		Root:         filepath.Join(m.appsDir(), suffix),
		Socket:       filepath.Join("/run/php", "rebecca-"+suffix+".sock"),
		PoolConfig:   filepath.Join("/etc/php", phpVersion, "fpm", "pool.d", "rebecca-"+suffix+".conf"),
		CronConfig:   filepath.Join("/etc/cron.d", "rebecca-php-"+suffix),
		Service:      "php" + phpVersion + "-fpm",
		SystemUser:   "rbphp_" + suffix,
		Database:     "rb_mirza_" + suffix,
		DatabaseUser: "rbm_" + suffix,
	}
	if err := m.ensureMirzaInstallTargetsFree(ctx, record); err != nil {
		return phpAppPublicRecord{}, err
	}

	var userCreated, appCreated, databaseCreated, poolCreated, cronCreated bool
	completed := false
	defer func() {
		if completed {
			return
		}
		_ = os.Remove(m.recordPath(suffix))
		_ = os.Remove(m.secretPath(suffix))
		if cronCreated {
			_ = os.Remove(record.CronConfig)
		}
		if poolCreated {
			_ = os.Remove(record.PoolConfig)
			_, _ = runPHPAppCommand(context.Background(), time.Minute, "systemctl", "reload", record.Service)
		}
		if databaseCreated {
			_ = m.dropPHPAppDatabase(context.Background(), record.Database, record.DatabaseUser)
		}
		if appCreated {
			_ = os.RemoveAll(record.Root)
		}
		if userCreated {
			_, _ = runPHPAppCommand(context.Background(), time.Minute, "userdel", record.SystemUser)
		}
	}()

	if _, err := runPHPAppCommand(ctx, time.Minute, "useradd", "--system", "--user-group", "--home-dir", record.Root, "--shell", "/usr/sbin/nologin", "--no-create-home", record.SystemUser); err != nil {
		return phpAppPublicRecord{}, fmt.Errorf("create isolated PHP user: %w", err)
	}
	userCreated = true
	if err := os.Rename(sourceRoot, record.Root); err != nil {
		return phpAppPublicRecord{}, fmt.Errorf("install MirzaBot source: %w", err)
	}
	appCreated = true
	_ = os.Remove(filepath.Join(record.Root, "install.sh"))
	uid, gid, err := unixUserIDs(ctx, record.SystemUser)
	if err != nil {
		return phpAppPublicRecord{}, err
	}
	if err := prepareOwnedPHPAppTree(record.Root, uid, gid); err != nil {
		return phpAppPublicRecord{}, err
	}
	if err := installMirzaBotDependencies(ctx, record.Root, record.SystemUser); err != nil {
		return phpAppPublicRecord{}, err
	}
	databasePassword, err := randomHex(24)
	if err != nil {
		return phpAppPublicRecord{}, err
	}
	databaseCreated = true
	if err := m.createPHPAppDatabase(ctx, record.Database, record.DatabaseUser, databasePassword); err != nil {
		return phpAppPublicRecord{}, err
	}
	configPath := filepath.Join(record.Root, "config.php")
	config := mirzaBotConfig(record.Database, record.DatabaseUser, databasePassword, request.BotToken, request.AdminID, domain, botUsername)
	if err := os.WriteFile(configPath, []byte(config), 0o600); err != nil {
		return phpAppPublicRecord{}, fmt.Errorf("write MirzaBot configuration: %w", err)
	}
	if err := os.Chown(configPath, uid, gid); err != nil {
		return phpAppPublicRecord{}, err
	}
	if err := initializeMirzaBotDatabase(ctx, record.Root, record.SystemUser, uid, gid); err != nil {
		return phpAppPublicRecord{}, err
	}
	if err := m.verifyPHPAppDatabase(ctx, record.Database); err != nil {
		return phpAppPublicRecord{}, err
	}
	webhookSecret, err := randomHex(32)
	if err != nil {
		return phpAppPublicRecord{}, err
	}
	cronSecret, err := randomHex(24)
	if err != nil {
		return phpAppPublicRecord{}, err
	}
	if err := writePHPAppSecretFile(record.Root, ".rebecca-cron-secret", cronSecret, uid, gid); err != nil {
		return phpAppPublicRecord{}, err
	}
	if err := writePHPAppPool(record, true); err != nil {
		return phpAppPublicRecord{}, err
	}
	poolCreated = true
	if err := writeMirzaCron(record); err != nil {
		return phpAppPublicRecord{}, err
	}
	cronCreated = true
	if err := reloadPHPFPM(ctx, record); err != nil {
		return phpAppPublicRecord{}, err
	}
	secrets := phpAppSecrets{BotToken: request.BotToken, WebhookSecret: webhookSecret, CronSecret: cronSecret}
	if err := m.writeSecrets(domain, secrets); err != nil {
		return phpAppPublicRecord{}, err
	}
	if err := m.writeRecord(record); err != nil {
		return phpAppPublicRecord{}, err
	}
	if err := m.setTelegramWebhook(ctx, request.BotToken, domain, webhookSecret); err != nil {
		return phpAppPublicRecord{}, err
	}
	record.Enabled = true
	if err := m.writeRecord(record); err != nil {
		_ = m.deleteTelegramWebhook(context.Background(), request.BotToken)
		return phpAppPublicRecord{}, err
	}
	m.setRecord(record)
	completed = true
	return publicPHPAppRecord(record), nil
}

func (m *phpAppManager) ensureBotTokenAvailable(token string) error {
	m.mu.RLock()
	domains := make([]string, 0, len(m.apps))
	for _, record := range m.apps {
		if record.Template == "mirzabot" {
			domains = append(domains, record.Domain)
		}
	}
	m.mu.RUnlock()
	for _, domain := range domains {
		secrets, err := m.readSecrets(domain)
		if err != nil {
			return err
		}
		if subtleConstantStringEqual(secrets.BotToken, token) {
			return errors.New("this Telegram bot is already hosted")
		}
	}
	return nil
}

func subtleConstantStringEqual(left, right string) bool {
	return len(left) == len(right) && subtle.ConstantTimeCompare([]byte(left), []byte(right)) == 1
}

func (m *phpAppManager) setEnabled(ctx context.Context, domain string, enabled bool) (phpAppPublicRecord, error) {
	if !m.operationMu.TryLock() {
		return phpAppPublicRecord{}, errPHPAppBusy
	}
	defer m.operationMu.Unlock()
	record, ok := m.lookup(domain)
	if !ok {
		return phpAppPublicRecord{}, errPHPAppNotFound
	}
	if enabled {
		if _, err := m.certificateDomain(ctx, record.Domain); err != nil {
			return phpAppPublicRecord{}, err
		}
		if record.Template == "mirzabot" {
			secrets, err := m.readSecrets(record.Domain)
			if err != nil {
				return phpAppPublicRecord{}, err
			}
			if err := m.setTelegramWebhook(ctx, secrets.BotToken, record.Domain, secrets.WebhookSecret); err != nil {
				return phpAppPublicRecord{}, err
			}
			if err := writeMirzaCron(record); err != nil {
				_ = m.deleteTelegramWebhook(context.Background(), secrets.BotToken)
				return phpAppPublicRecord{}, err
			}
		}
		record.Enabled = true
	} else {
		record.Enabled = false
	}
	if err := m.writeRecord(record); err != nil {
		if enabled && record.Template == "mirzabot" {
			_ = os.Remove(record.CronConfig)
			if secrets, secretErr := m.readSecrets(record.Domain); secretErr == nil {
				_ = m.deleteTelegramWebhook(context.Background(), secrets.BotToken)
			}
		}
		return phpAppPublicRecord{}, err
	}
	m.setRecord(record)
	if !enabled && record.Template == "mirzabot" {
		if err := os.Remove(record.CronConfig); err != nil && !os.IsNotExist(err) {
			return publicPHPAppRecord(record), err
		}
		secrets, err := m.readSecrets(record.Domain)
		if err != nil {
			return publicPHPAppRecord(record), err
		}
		if err := m.deleteTelegramWebhook(ctx, secrets.BotToken); err != nil {
			return publicPHPAppRecord(record), err
		}
	}
	return publicPHPAppRecord(record), nil
}

func (m *phpAppManager) delete(ctx context.Context, domain string) error {
	if !m.operationMu.TryLock() {
		return errPHPAppBusy
	}
	defer m.operationMu.Unlock()
	record, ok := m.lookup(domain)
	if !ok {
		return errPHPAppNotFound
	}
	record.Enabled = false
	if err := m.writeRecord(record); err != nil {
		return err
	}
	m.setRecord(record)
	if record.Template == "mirzabot" {
		if secrets, err := m.readSecrets(record.Domain); err == nil {
			_ = m.deleteTelegramWebhook(ctx, secrets.BotToken)
		}
	}
	if record.CronConfig != "" {
		if err := os.Remove(record.CronConfig); err != nil && !os.IsNotExist(err) {
			return err
		}
	}
	if record.PoolConfig != "" {
		if err := os.Remove(record.PoolConfig); err != nil && !os.IsNotExist(err) {
			return err
		}
		if _, err := runPHPAppCommand(ctx, time.Minute, "systemctl", "reload", record.Service); err != nil {
			return fmt.Errorf("reload PHP-FPM: %w", err)
		}
	}
	if record.Database != "" {
		if err := m.dropPHPAppDatabase(ctx, record.Database, record.DatabaseUser); err != nil {
			return err
		}
	}
	if err := os.RemoveAll(record.Root); err != nil {
		return err
	}
	if record.SystemUser != "" {
		if _, err := runPHPAppCommand(ctx, time.Minute, "userdel", record.SystemUser); err != nil && phpAppSystemUserExists(ctx, record.SystemUser) {
			return fmt.Errorf("remove isolated PHP user: %w", err)
		}
	}
	suffix := domainHash(record.Domain)
	if err := os.Remove(m.recordPath(suffix)); err != nil && !os.IsNotExist(err) {
		return err
	}
	if err := os.Remove(m.secretPath(suffix)); err != nil && !os.IsNotExist(err) {
		return err
	}
	m.removeRecord(record.Domain)
	return nil
}

func (m *phpAppManager) prepareStorage() error {
	for _, dir := range []string{m.baseDir, m.appsDir(), m.metadataDir(), m.secretsDir()} {
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return fmt.Errorf("prepare PHP application storage: %w", err)
		}
	}
	if err := os.Chmod(m.baseDir, 0o711); err != nil {
		return err
	}
	return os.Chmod(m.appsDir(), 0o711)
}

func (m *phpAppManager) writeRecord(record phpAppRecord) error {
	return writePrivateJSON(m.recordPath(domainHash(record.Domain)), record)
}

func (m *phpAppManager) writeSecrets(domain string, secrets phpAppSecrets) error {
	return writePrivateJSON(m.secretPath(domainHash(domain)), secrets)
}

func (m *phpAppManager) readSecrets(domain string) (phpAppSecrets, error) {
	data, err := os.ReadFile(m.secretPath(domainHash(domain)))
	if err != nil {
		return phpAppSecrets{}, fmt.Errorf("read PHP application secrets: %w", err)
	}
	var secrets phpAppSecrets
	if err := json.Unmarshal(data, &secrets); err != nil {
		return phpAppSecrets{}, errors.New("PHP application secrets are invalid")
	}
	return secrets, nil
}

func (m *phpAppManager) appsDir() string     { return filepath.Join(m.baseDir, "apps") }
func (m *phpAppManager) metadataDir() string { return filepath.Join(m.baseDir, ".metadata") }
func (m *phpAppManager) secretsDir() string  { return filepath.Join(m.baseDir, ".secrets") }
func (m *phpAppManager) recordPath(suffix string) string {
	return filepath.Join(m.metadataDir(), suffix+".json")
}
func (m *phpAppManager) secretPath(suffix string) string {
	return filepath.Join(m.secretsDir(), suffix+".json")
}

func writePrivateJSON(path string, value any) error {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	temp, err := os.CreateTemp(filepath.Dir(path), ".record-*.tmp")
	if err != nil {
		return err
	}
	name := temp.Name()
	defer os.Remove(name)
	if err := temp.Chmod(0o600); err != nil {
		temp.Close()
		return err
	}
	if _, err := temp.Write(data); err != nil {
		temp.Close()
		return err
	}
	if err := temp.Sync(); err != nil {
		temp.Close()
		return err
	}
	if err := temp.Close(); err != nil {
		return err
	}
	return os.Rename(name, path)
}

func (s *Server) handlePHPApps(w http.ResponseWriter, r *http.Request) {
	if s.phpApps == nil {
		writeError(w, http.StatusServiceUnavailable, "PHP application manager is unavailable")
		return
	}
	requestPath := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/settings/php-apps"), "/")
	if requestPath == "" {
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		supported, detail := s.phpApps.hostingSupported()
		mirzaSupported, mirzaDetail := s.phpApps.mirzaSupported()
		writeJSON(w, http.StatusOK, map[string]any{
			"supported": supported,
			"detail":    detail,
			"templates": []map[string]any{
				{"id": "archive", "name": "PHP / HTML ZIP", "supported": supported},
				{"id": "mirzabot", "name": "MirzaBot", "version": mirzaBotVersion, "source_sha": mirzaBotSourceSHA, "supported": mirzaSupported, "detail": mirzaDetail},
			},
			"apps": s.phpApps.publicRecords(),
		})
		return
	}
	switch requestPath {
	case "archive":
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		s.handlePHPAppArchiveInstall(w, r)
		return
	case "mirzabot":
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		var payload phpAppInstallRequest
		if err := decodeOptionalJSON(r, &payload); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		if phpAppUsesCurrentPanelHost(r, payload.Domain) {
			writeError(w, http.StatusBadRequest, "the current panel hostname cannot be replaced by an application")
			return
		}
		record, err := s.phpApps.installMirzaBot(r.Context(), payload)
		if err != nil {
			writePHPAppError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, record)
		return
	}
	parts := strings.Split(requestPath, "/")
	domain, err := url.PathUnescape(parts[0])
	if err != nil || domain == "" {
		writeError(w, http.StatusBadRequest, "invalid domain")
		return
	}
	if len(parts) == 1 && r.Method == http.MethodDelete {
		if err := s.phpApps.delete(r.Context(), domain); err != nil {
			writePHPAppError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if len(parts) != 2 || r.Method != http.MethodPost || (parts[1] != "enable" && parts[1] != "disable") {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	record, err := s.phpApps.setEnabled(r.Context(), domain, parts[1] == "enable")
	if err != nil {
		writePHPAppError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, record)
}

func (s *Server) handlePHPAppArchiveInstall(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(maxPHPAppRequestBodyBytes); err != nil {
		writeError(w, http.StatusBadRequest, "invalid multipart upload")
		return
	}
	if r.MultipartForm != nil {
		defer r.MultipartForm.RemoveAll()
	}
	file, _, err := r.FormFile("archive")
	if err != nil {
		writeError(w, http.StatusBadRequest, "ZIP archive is required")
		return
	}
	defer file.Close()
	if phpAppUsesCurrentPanelHost(r, r.FormValue("domain")) {
		writeError(w, http.StatusBadRequest, "the current panel hostname cannot be replaced by an application")
		return
	}
	data, err := io.ReadAll(io.LimitReader(file, maxPHPAppArchiveBytes+1))
	if err != nil || len(data) > maxPHPAppArchiveBytes {
		writeError(w, http.StatusRequestEntityTooLarge, "ZIP archive exceeds 32 MiB")
		return
	}
	record, err := s.phpApps.installArchive(r.Context(), r.FormValue("domain"), r.FormValue("name"), data)
	if err != nil {
		writePHPAppError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, record)
}

func phpAppUsesCurrentPanelHost(r *http.Request, domain string) bool {
	domain = canonicalPHPAppHost(domain)
	return domain != "" && domain == canonicalPHPAppHost(r.Host)
}

func writePHPAppError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, errPHPAppNotFound):
		writeError(w, http.StatusNotFound, err.Error())
	case errors.Is(err, errPHPAppBusy), errors.Is(err, errPHPAppExists):
		writeError(w, http.StatusConflict, err.Error())
	case errors.Is(err, errPHPAppUnsupported):
		writeError(w, http.StatusUnprocessableEntity, err.Error())
	default:
		writeError(w, http.StatusBadRequest, err.Error())
	}
}

func normalizePHPAppName(value, domain string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return domain
	}
	runes := []rune(value)
	if len(runes) > 80 {
		runes = runes[:80]
	}
	return string(runes)
}

func sha256Hex(data []byte) string {
	digest := sha256.Sum256(data)
	return hex.EncodeToString(digest[:])
}

func randomHex(bytesCount int) (string, error) {
	data := make([]byte, bytesCount)
	if _, err := rand.Read(data); err != nil {
		return "", err
	}
	return hex.EncodeToString(data), nil
}

func domainHash(domain string) string {
	digest := sha256.Sum256([]byte(strings.ToLower(domain)))
	return hex.EncodeToString(digest[:6])
}

func extractMirzaBotArchive(data []byte, destination string) (string, error) {
	root, err := extractZIPArchive(data, destination, true)
	if err != nil {
		return "", err
	}
	for _, required := range []string{"composer.json", "composer.lock", "table.php", "config.php", "index.php"} {
		if info, err := os.Stat(filepath.Join(root, required)); err != nil || info.IsDir() {
			return "", fmt.Errorf("MirzaBot archive is missing %s", required)
		}
	}
	return root, nil
}

func extractPHPAppArchive(data []byte, destination string) (string, error) {
	return extractZIPArchive(data, destination, false)
}

func extractZIPArchive(data []byte, destination string, requireSingleRoot bool) (string, error) {
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", errors.New("upload is not a valid ZIP archive")
	}
	if len(reader.File) == 0 || len(reader.File) > maxPHPAppFiles {
		return "", errors.New("ZIP archive has an invalid file count")
	}
	rootName := ""
	singleRoot := true
	var total uint64
	for _, entry := range reader.File {
		name := strings.ReplaceAll(entry.Name, "\\", "/")
		clean := filepath.ToSlash(filepath.Clean(name))
		if clean == "." || clean == ".." || strings.HasPrefix(clean, "../") || strings.HasPrefix(clean, "/") {
			return "", errors.New("ZIP archive contains an unsafe path")
		}
		parts := strings.Split(clean, "/")
		if rootName == "" {
			rootName = parts[0]
		} else if parts[0] != rootName {
			singleRoot = false
		}
		if len(parts) == 1 && !entry.FileInfo().IsDir() {
			singleRoot = false
		}
		mode := entry.Mode()
		if mode&os.ModeSymlink != 0 || mode&(os.ModeDevice|os.ModeNamedPipe|os.ModeSocket) != 0 {
			return "", errors.New("ZIP archive contains an unsupported file type")
		}
		total += entry.UncompressedSize64
		if total > maxPHPAppExtractedSize {
			return "", errors.New("ZIP archive exceeds the 256 MiB extracted size limit")
		}
		target := filepath.Join(destination, filepath.FromSlash(clean))
		if !pathWithin(destination, target) {
			return "", errors.New("ZIP archive escaped the staging directory")
		}
		if entry.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0o755); err != nil {
				return "", err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return "", err
		}
		source, err := entry.Open()
		if err != nil {
			return "", err
		}
		file, err := os.OpenFile(target, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o644)
		if err != nil {
			source.Close()
			return "", err
		}
		written, copyErr := io.Copy(file, io.LimitReader(source, int64(entry.UncompressedSize64)+1))
		closeErr := file.Close()
		source.Close()
		if copyErr != nil || closeErr != nil || written != int64(entry.UncompressedSize64) {
			return "", errors.New("extract ZIP archive")
		}
	}
	if requireSingleRoot && !singleRoot {
		return "", errors.New("template archive has multiple roots")
	}
	if singleRoot {
		root := filepath.Join(destination, rootName)
		if info, err := os.Stat(root); err == nil && info.IsDir() {
			return root, nil
		}
	}
	return destination, nil
}

func detectPHPAppRuntime(root string) (string, error) {
	runtime := "static"
	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && strings.EqualFold(filepath.Ext(path), ".php") {
			runtime = "php"
		}
		return nil
	})
	if err != nil {
		return "", err
	}
	index := "index.html"
	if runtime == "php" {
		index = "index.php"
		if _, err := os.Stat(filepath.Join(root, index)); err != nil {
			if _, htmlErr := os.Stat(filepath.Join(root, "index.html")); htmlErr != nil {
				return "", errors.New("PHP archive must contain index.php or index.html at its root")
			}
		}
	} else if _, err := os.Stat(filepath.Join(root, index)); err != nil {
		return "", errors.New("HTML archive must contain index.html at its root")
	}
	return runtime, nil
}

func canonicalPHPAppHost(host string) string {
	host = strings.ToLower(strings.TrimSpace(host))
	if parsed, err := url.Parse("//" + host); err == nil && parsed.Hostname() != "" {
		host = parsed.Hostname()
	}
	return strings.TrimSuffix(host, ".")
}

func pathWithin(root, candidate string) bool {
	root, err := filepath.Abs(filepath.Clean(root))
	if err != nil {
		return false
	}
	candidate, err = filepath.Abs(filepath.Clean(candidate))
	if err != nil {
		return false
	}
	return candidate == root || strings.HasPrefix(candidate, root+string(os.PathSeparator))
}

func isLocalDatabaseHost(host string) bool {
	switch strings.ToLower(strings.TrimSpace(host)) {
	case "127.0.0.1", "localhost", "::1":
		return true
	default:
		return false
	}
}

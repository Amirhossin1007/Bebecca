package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/rebeccapanel/rebecca/go/internal/gateway"
)

func main() {
	cfg := gateway.LoadConfig()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	masterAPI, masterAPIURL, err := gateway.StartMasterAPI(ctx, cfg)
	if err != nil {
		log.Printf("native Go Master API sidecar is unavailable; Python node routes will use fallback: %v", err)
	} else {
		cfg.MasterAPIURL = masterAPIURL
		log.Printf("native Go Master API sidecar is healthy on %s", cfg.MasterAPIURL)
		go func() {
			if err := <-masterAPI.Err(); err != nil {
				log.Printf("native Go Master API sidecar stopped; gateway will fall back to Python for node routes: %v", err)
			}
		}()
	}

	python, err := gateway.StartPython(ctx, cfg)
	if err != nil {
		log.Fatalf("failed to start python runtime: %v", err)
	}
	defer python.Stop()

	server, err := gateway.NewServer(cfg)
	if err != nil {
		log.Fatalf("failed to initialize gateway: %v", err)
	}

	errCh := make(chan error, 1)
	go func() {
		log.Printf("rebecca gateway listening on %s and proxying python on %s", cfg.Addr, cfg.PythonAddr())
		errCh <- server.Run()
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			log.Printf("gateway shutdown failed: %v", err)
		}
	case err := <-errCh:
		if err != nil {
			log.Fatalf("gateway failed: %v", err)
		}
	}
}

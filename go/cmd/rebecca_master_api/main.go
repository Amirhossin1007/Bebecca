package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/rebeccapanel/rebecca/go/internal/app/masterapi"
)

func main() {
	cfg, err := masterapi.LoadConfig()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	server, err := masterapi.New(cfg)
	if err != nil {
		log.Fatalf("initialize master api: %v", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if cfg.TLSCert != "" && cfg.TLSKey != "" {
		fmt.Printf("Rebecca Go master API listening on https://%s\n", cfg.Address)
	} else {
		fmt.Printf("Rebecca Go master API listening on http://%s\n", cfg.Address)
	}
	if err := server.Serve(ctx); err != nil && !errors.Is(err, context.Canceled) {
		log.Fatalf("serve: %v", err)
	}
}

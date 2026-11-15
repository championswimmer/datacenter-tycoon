// Command server runs the Datacenter Tycoon HTTP backend (Go port of packages/server).
package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/championswimmer/datacenter-tycoon/server-go/internal/config"
	"github.com/championswimmer/datacenter-tycoon/server-go/internal/httpserver"
	"github.com/championswimmer/datacenter-tycoon/server-go/jsbridge"
)

const shutdownTimeout = 10 * time.Second

func main() {
	if err := run(); err != nil {
		var cfgErr *config.Error
		prefix := "Server failed to start"
		if errors.As(err, &cfgErr) {
			prefix = "Invalid server configuration"
		}
		fmt.Fprintf(os.Stderr, "%s: %s\n", prefix, err.Error())
		os.Exit(1)
	}
}

func envMap() map[string]string {
	env := map[string]string{}
	for _, kv := range os.Environ() {
		if k, v, ok := strings.Cut(kv, "="); ok {
			env[k] = v
		}
	}
	return env
}

func run() error {
	// Fail fast on bad configuration before spending time on the JS runtime.
	if _, err := config.Load(envMap()); err != nil {
		return err
	}
	runtime, err := jsbridge.Default()
	if err != nil {
		return fmt.Errorf("load game-logic runtime: %w", err)
	}
	config.DefaultGameLogicVersion = runtime.Version()
	cfg, err := config.Load(envMap())
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	deps, err := httpserver.NewRuntimeServices(ctx, cfg)
	if err != nil {
		return err
	}
	defer func() {
		if deps.Close != nil {
			_ = deps.Close(context.Background())
		}
	}()

	server := &http.Server{
		Handler:           httpserver.NewApp(deps, cfg),
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	listener, err := net.Listen("tcp", net.JoinHostPort(cfg.Host, strconv.Itoa(cfg.Port)))
	if err != nil {
		return err
	}
	info := config.RuntimeInfo(cfg)
	log.Printf("Datacenter Tycoon server listening on %s (runtime=go, framework=net/http, db=%s/%s, game-logic v%s)",
		listener.Addr(), info.Mode, info.Provider, cfg.GameLogicVersion)

	serveErr := make(chan error, 1)
	go func() { serveErr <- server.Serve(listener) }()

	select {
	case err := <-serveErr:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
		return nil
	case <-ctx.Done():
		log.Printf("shutdown signal received; draining connections")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			_ = server.Close()
			return fmt.Errorf("graceful shutdown: %w", err)
		}
		return nil
	}
}

package httpserver

import (
	"net/http"

	"github.com/championswimmer/datacenter-tycoon/server-go/internal/config"
)

// Runtime metadata reported by /healthz.
const (
	runtimeName   = "go"
	frameworkName = "net/http"
)

type healthResponse struct {
	Status             string `json:"status"`
	Environment        string `json:"environment"`
	Runtime            string `json:"runtime"`
	Framework          string `json:"framework"`
	DatabaseMode       string `json:"databaseMode"`
	DatabaseProvider   string `json:"databaseProvider"`
	DatabaseConfigured bool   `json:"databaseConfigured"`
}

type versionResponse struct {
	ServerVersion    string `json:"serverVersion"`
	GameLogicVersion string `json:"gameLogicVersion"`
}

func (a *app) health(w http.ResponseWriter, r *http.Request) error {
	info := config.RuntimeInfo(a.cfg)
	writeJSON(w, r, http.StatusOK, healthResponse{
		Status:             "ok",
		Environment:        string(a.cfg.Environment),
		Runtime:            runtimeName,
		Framework:          frameworkName,
		DatabaseMode:       string(info.Mode),
		DatabaseProvider:   string(info.Provider),
		DatabaseConfigured: info.Configured,
	})
	return nil
}

func (a *app) version(w http.ResponseWriter, r *http.Request) error {
	writeJSON(w, r, http.StatusOK, versionResponse{
		ServerVersion:    a.cfg.ServerVersion,
		GameLogicVersion: a.cfg.GameLogicVersion,
	})
	return nil
}

package httpserver

import (
	"net/http"

	"github.com/championswimmer/datacenter-tycoon/server-go/internal/players"
)

const maxPlayerBodyBytes = 1 << 20

func errPlayersUnavailable() error {
	return NewHTTPError(503, "PLAYERS_UNAVAILABLE", "Player registration is not configured.")
}

func (a *app) playerAvailability(w http.ResponseWriter, r *http.Request) error {
	if a.deps.Players == nil {
		return errPlayersUnavailable()
	}
	query := parseSearchParams(r.URL.RawQuery)
	values, ok := query["username"]
	if !ok {
		return NewHTTPError(400, "INVALID_USERNAME", "username query parameter is required.")
	}
	result, err := players.CheckUsernameAvailability(r.Context(), a.deps.Players, values[0])
	if err != nil {
		return err
	}
	writeJSON(w, r, http.StatusOK, result)
	return nil
}

func (a *app) registerPlayer(w http.ResponseWriter, r *http.Request) error {
	if a.deps.Players == nil {
		return errPlayersUnavailable()
	}
	if a.deps.RateLimiter != nil {
		if err := a.enforceClientRateLimit(r, "player registrations", a.cfg.RateLimits.PlayerRegistration); err != nil {
			return err
		}
	}

	body, err := readBody(r, maxPlayerBodyBytes)
	if err != nil {
		return invalidJSON()
	}
	payload, err := decodeJSON(body)
	if err != nil {
		return invalidJSON()
	}
	// Mirrors the TS checks: anything that is not an object with a string `username` is rejected
	// with the same INVALID_USERNAME message (null, arrays, numbers, missing/non-string username).
	object, _ := payload.(map[string]any)
	username, ok := object["username"].(string)
	if !ok {
		return NewHTTPError(400, "INVALID_USERNAME", "Request body must include a username string.")
	}

	registration, err := players.RegisterPlayerUsername(r.Context(), a.deps.Players, username)
	if err != nil {
		return err
	}
	writeJSON(w, r, http.StatusCreated, registration)
	return nil
}

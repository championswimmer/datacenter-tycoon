package httpserver

import (
	"bytes"
	"encoding/json"
	"net/http"
	"strconv"
)

const jsonContentType = "application/json;charset=utf-8"

// marshalJSON is JSON.stringify-like: compact and without Go's HTML escaping.
func marshalJSON(v any) ([]byte, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		return nil, err
	}
	return bytes.TrimRight(buf.Bytes(), "\n"), nil
}

// writeJSON writes a JSON response. For HEAD requests the body is omitted but Content-Length kept,
// matching Elysia's automatic HEAD handling.
func writeJSON(w http.ResponseWriter, r *http.Request, status int, v any) {
	body, err := marshalJSON(v)
	if err != nil {
		status = http.StatusInternalServerError
		body, _ = marshalJSON(CreateErrorBody("INTERNAL_SERVER_ERROR", err.Error()))
	}
	w.Header().Set("Content-Type", jsonContentType)
	w.Header().Set("Content-Length", strconv.Itoa(len(body)))
	w.WriteHeader(status)
	if r.Method != http.MethodHead {
		_, _ = w.Write(body)
	}
}

func writeError(w http.ResponseWriter, r *http.Request, err error) {
	status, code, message := resolveError(err)
	writeJSON(w, r, status, CreateErrorBody(code, message))
}

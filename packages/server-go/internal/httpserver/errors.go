// Package httpserver is the net/http transport for the Datacenter Tycoon server. It replicates the
// observable behavior of the Elysia app in packages/server (error envelopes, CORS quirks, routing).
package httpserver

import (
	"errors"
	"fmt"

	"github.com/championswimmer/datacenter-tycoon/server-go/internal/players"
)

// HTTPError mirrors the TS HttpError (status, code, message).
type HTTPError struct {
	Status  int
	Code    string
	Message string
}

func (e *HTTPError) Error() string { return e.Message }

// NewHTTPError builds an HTTPError.
func NewHTTPError(status int, code, message string) *HTTPError {
	return &HTTPError{Status: status, Code: code, Message: message}
}

// ErrorBody is the shared JSON error envelope: {"error":{"code":...,"message":...}}.
type ErrorBody struct {
	Error ErrorDetail `json:"error"`
}

// ErrorDetail is the inner object of ErrorBody.
type ErrorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// CreateErrorBody mirrors createErrorBody.
func CreateErrorBody(code, message string) ErrorBody {
	return ErrorBody{Error: ErrorDetail{Code: code, Message: message}}
}

// statusCoder is implemented by domain errors that already carry an HTTP mapping.
type statusCoder interface {
	HTTPStatus() int
	ErrorCode() string
}

// resolveError maps any error to (status, code, message) like the Elysia onError hook:
// HttpError-style errors keep their mapping, everything else becomes 500 INTERNAL_SERVER_ERROR
// carrying the error message.
func resolveError(err error) (int, string, string) {
	var httpErr *HTTPError
	if errors.As(err, &httpErr) {
		return httpErr.Status, httpErr.Code, httpErr.Message
	}
	var statusErr *players.StatusError
	if errors.As(err, &statusErr) {
		return statusErr.Status, statusErr.Code, statusErr.Message
	}
	var coded statusCoder
	if errors.As(err, &coded) {
		return coded.HTTPStatus(), coded.ErrorCode(), err.Error()
	}
	msg := "Unknown server error"
	if err != nil {
		msg = err.Error()
	}
	return 500, "INTERNAL_SERVER_ERROR", msg
}

func panicToError(v any) error {
	if e, ok := v.(error); ok {
		return e
	}
	return fmt.Errorf("%v", v)
}

// Package players ports packages/server/src/players: username rules, identity
// helpers, repository interface, in-memory repository, and service functions.
package players

import (
	"crypto/rand"
	"fmt"
	"regexp"
	"strings"
	"time"

	"golang.org/x/text/unicode/norm"
)

const (
	MinUsernameLength = 3
	MaxUsernameLength = 24
)

var usernamePattern = regexp.MustCompile(`^[A-Za-z0-9](?:[A-Za-z0-9 ._-]*[A-Za-z0-9])?$`)

// CodeInvalidUsername is the error code of UsernameValidationError.
const CodeInvalidUsername = "INVALID_USERNAME"

// CodeUsernameUnavailable is the error code of UsernameUnavailableError.
const CodeUsernameUnavailable = "USERNAME_UNAVAILABLE"

// DefaultUsernameUnavailableMessage matches the TS default message.
const DefaultUsernameUnavailableMessage = "That username is already taken. Choose another one."

// UsernameValidationError mirrors the TS class of the same name.
type UsernameValidationError struct {
	Code    string
	Message string
}

func (e *UsernameValidationError) Error() string { return e.Message }

func newUsernameValidationError(msg string) *UsernameValidationError {
	return &UsernameValidationError{Code: CodeInvalidUsername, Message: msg}
}

// UsernameUnavailableError mirrors the TS class of the same name.
type UsernameUnavailableError struct {
	Code    string
	Message string
}

func (e *UsernameUnavailableError) Error() string { return e.Message }

// NewUsernameUnavailableError builds the error with the default message.
func NewUsernameUnavailableError() *UsernameUnavailableError {
	return &UsernameUnavailableError{Code: CodeUsernameUnavailable, Message: DefaultUsernameUnavailableMessage}
}

// UsernameRegistration is the parsed form of a raw username.
type UsernameRegistration struct {
	Username           string
	NormalizedUsername string
}

// RegisteredPlayer is a persisted player. JSON names match the TS shape.
type RegisteredPlayer struct {
	PlayerID           string    `json:"playerId"`
	Username           string    `json:"username"`
	NormalizedUsername string    `json:"normalizedUsername"`
	CreatedAt          time.Time `json:"createdAt"`
	LastSeenAt         time.Time `json:"lastSeenAt"`
}

// CreatePlayerInput mirrors TS CreatePlayerInput. Zero Now means time.Now().
type CreatePlayerInput struct {
	PlayerID           string
	Username           string
	NormalizedUsername string
	Now                time.Time
}

// RegisterPlayerInput is the input of PlayersRepository.CreatePlayer.
type RegisterPlayerInput struct {
	Username string
}

// jsIsSpace reports whether r is in the ECMAScript WhiteSpace or LineTerminator
// sets (what String.prototype.trim and the regex \s match).
func jsIsSpace(r rune) bool {
	switch r {
	case '\t', '\n', '\v', '\f', '\r', ' ', 0x00A0, 0x1680, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF:
		return true
	}
	return r >= 0x2000 && r <= 0x200A
}

// JSTrim is String.prototype.trim.
func JSTrim(s string) string { return strings.TrimFunc(s, jsIsSpace) }

// UTF16Len is JS string .length.
func UTF16Len(s string) int {
	n := 0
	for _, r := range s {
		if r >= 0x10000 {
			n += 2
		} else {
			n++
		}
	}
	return n
}

// NormalizeUsername mirrors normalizeUsername: NFKC, trim, collapse whitespace runs.
func NormalizeUsername(raw string) string {
	s := JSTrim(norm.NFKC.String(raw))
	var b strings.Builder
	inSpace := false
	for _, r := range s {
		if jsIsSpace(r) {
			if !inSpace {
				b.WriteByte(' ')
			}
			inSpace = true
			continue
		}
		inSpace = false
		b.WriteRune(r)
	}
	return b.String()
}

// ParseUsernameRegistration mirrors parseUsernameRegistration. Errors are *UsernameValidationError.
func ParseUsernameRegistration(raw string) (UsernameRegistration, error) {
	username := NormalizeUsername(raw)
	n := UTF16Len(username)
	if n < MinUsernameLength {
		return UsernameRegistration{}, newUsernameValidationError(
			fmt.Sprintf("Username must be at least %d characters long.", MinUsernameLength))
	}
	if n > MaxUsernameLength {
		return UsernameRegistration{}, newUsernameValidationError(
			fmt.Sprintf("Username must be at most %d characters long.", MaxUsernameLength))
	}
	if !usernamePattern.MatchString(username) {
		return UsernameRegistration{}, newUsernameValidationError(
			"Username may only contain letters, numbers, spaces, periods, underscores, and hyphens.")
	}
	// Pattern restricts to ASCII, so lower-casing is locale independent.
	return UsernameRegistration{Username: username, NormalizedUsername: strings.ToLower(username)}, nil
}

// GeneratePlayerID returns a random v4 UUID string.
func GeneratePlayerID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic(err)
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// CreateRegisteredPlayer mirrors createRegisteredPlayer.
func CreateRegisteredPlayer(in CreatePlayerInput) RegisteredPlayer {
	now := in.Now
	if now.IsZero() {
		now = time.Now()
	}
	return RegisteredPlayer{
		PlayerID: in.PlayerID, Username: in.Username, NormalizedUsername: in.NormalizedUsername,
		CreatedAt: now, LastSeenAt: now,
	}
}

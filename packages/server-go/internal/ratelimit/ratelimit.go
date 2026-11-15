// Package ratelimit ports packages/server/src/rate-limit/fixed-window.ts.
package ratelimit

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Rule is a fixed-window throttle: at most MaxRequests per WindowMs.
type Rule struct {
	WindowMs    int64
	MaxRequests int64
}

// Decision is the outcome of a Consume call.
type Decision struct {
	Allowed           bool
	RetryAfterSeconds int64
	Remaining         int64
}

// Limiter consumes one unit from the bucket identified by scope+key.
type Limiter interface {
	Consume(scope, key string, rule Rule) Decision
}

type bucket struct {
	windowStartedAtMs int64
	count             int64
}

// InMemoryFixedWindow is a mutex-guarded fixed-window limiter.
type InMemoryFixedWindow struct {
	mu      sync.Mutex
	buckets map[string]*bucket
	now     func() time.Time
}

// NewInMemoryFixedWindow returns a limiter using the wall clock.
func NewInMemoryFixedWindow() *InMemoryFixedWindow {
	return NewInMemoryFixedWindowWithClock(time.Now)
}

// NewInMemoryFixedWindowWithClock returns a limiter using an injectable clock.
func NewInMemoryFixedWindowWithClock(now func() time.Time) *InMemoryFixedWindow {
	return &InMemoryFixedWindow{buckets: map[string]*bucket{}, now: now}
}

const sweepThreshold = 10_000

// Consume mirrors InMemoryFixedWindowRateLimiter.consume.
func (l *InMemoryFixedWindow) Consume(scope, key string, rule Rule) Decision {
	l.mu.Lock()
	defer l.mu.Unlock()

	bucketKey := scope + ":" + key
	nowMs := l.now().UnixMilli()

	active, ok := l.buckets[bucketKey]
	if !ok || nowMs-active.windowStartedAtMs >= rule.WindowMs {
		active = &bucket{windowStartedAtMs: nowMs}
	}

	if active.count >= rule.MaxRequests {
		retryAfterMs := active.windowStartedAtMs + rule.WindowMs - nowMs
		secs := (retryAfterMs + 999) / 1000 // ceil for positive values
		if retryAfterMs <= 0 {
			secs = 0
		}
		if secs < 1 {
			secs = 1
		}
		return Decision{Allowed: false, RetryAfterSeconds: secs, Remaining: 0}
	}

	active.count++
	l.buckets[bucketKey] = active
	if len(l.buckets) > sweepThreshold {
		l.sweepLocked(nowMs, rule.WindowMs)
	}

	remaining := rule.MaxRequests - active.count
	if remaining < 0 {
		remaining = 0
	}
	return Decision{Allowed: true, RetryAfterSeconds: 0, Remaining: remaining}
}

// sweepLocked drops buckets whose window has long expired; it never affects decisions
// because an expired bucket is replaced by a fresh one anyway. Uses the current rule's
// window as a conservative bound only for buckets older than an hour.
func (l *InMemoryFixedWindow) sweepLocked(nowMs, _ int64) {
	const maxAgeMs = int64(time.Hour / time.Millisecond)
	for k, b := range l.buckets {
		if nowMs-b.windowStartedAtMs > maxAgeMs {
			delete(l.buckets, k)
		}
	}
}

// ClientKey mirrors getClientRateLimitKey: x-forwarded-for (first hop), cf-connecting-ip,
// x-real-ip, then the socket address, else "anonymous".
func ClientKey(r *http.Request) string {
	if forwardedFor := r.Header.Get("X-Forwarded-For"); forwardedFor != "" {
		first, _, _ := strings.Cut(forwardedFor, ",")
		if candidate := strings.TrimSpace(first); candidate != "" {
			return candidate
		}
	}
	if v := strings.TrimSpace(r.Header.Get("CF-Connecting-IP")); v != "" {
		return v
	}
	if v := strings.TrimSpace(r.Header.Get("X-Real-IP")); v != "" {
		return v
	}
	if r.RemoteAddr != "" {
		host, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil {
			host = r.RemoteAddr
		}
		if host = strings.TrimSpace(host); host != "" {
			return host
		}
	}
	return "anonymous"
}

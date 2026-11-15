package ratelimit

import (
	"net/http/httptest"
	"testing"
	"time"
)

type fakeClock struct{ t time.Time }

func (c *fakeClock) now() time.Time { return c.t }

func TestFixedWindowAllowsThenBlocksThenResets(t *testing.T) {
	clock := &fakeClock{t: time.UnixMilli(1_000_000)}
	l := NewInMemoryFixedWindowWithClock(clock.now)
	rule := Rule{WindowMs: 1000, MaxRequests: 2}

	d := l.Consume("s", "k", rule)
	if !d.Allowed || d.Remaining != 1 || d.RetryAfterSeconds != 0 {
		t.Fatalf("first: %+v", d)
	}
	d = l.Consume("s", "k", rule)
	if !d.Allowed || d.Remaining != 0 {
		t.Fatalf("second: %+v", d)
	}
	clock.t = clock.t.Add(250 * time.Millisecond)
	d = l.Consume("s", "k", rule)
	if d.Allowed || d.RetryAfterSeconds != 1 || d.Remaining != 0 {
		t.Fatalf("third: %+v", d)
	}
	// other key and other scope are independent
	if !l.Consume("s", "other", rule).Allowed || !l.Consume("t", "k", rule).Allowed {
		t.Fatal("expected independent buckets")
	}
	clock.t = clock.t.Add(750 * time.Millisecond) // exactly window elapsed -> new window
	if d = l.Consume("s", "k", rule); !d.Allowed || d.Remaining != 1 {
		t.Fatalf("after window: %+v", d)
	}
}

func TestRetryAfterRoundsUp(t *testing.T) {
	clock := &fakeClock{t: time.UnixMilli(0)}
	l := NewInMemoryFixedWindowWithClock(clock.now)
	rule := Rule{WindowMs: 60_000, MaxRequests: 1}
	l.Consume("s", "k", rule)
	clock.t = clock.t.Add(500 * time.Millisecond)
	if d := l.Consume("s", "k", rule); d.RetryAfterSeconds != 60 { // 59.5s -> 60
		t.Fatalf("got %d", d.RetryAfterSeconds)
	}
	clock.t = time.UnixMilli(59_000)
	if d := l.Consume("s", "k", rule); d.RetryAfterSeconds != 1 {
		t.Fatalf("got %d", d.RetryAfterSeconds)
	}
	clock.t = time.UnixMilli(59_999)
	if d := l.Consume("s", "k", rule); d.RetryAfterSeconds != 1 { // min 1
		t.Fatalf("got %d", d.RetryAfterSeconds)
	}
}

func TestClientKeyPrecedence(t *testing.T) {
	r := httptest.NewRequest("GET", "/", nil)
	r.RemoteAddr = "10.0.0.9:5555"
	if got := ClientKey(r); got != "10.0.0.9" {
		t.Fatalf("socket: %q", got)
	}
	r.Header.Set("X-Real-IP", " 3.3.3.3 ")
	if got := ClientKey(r); got != "3.3.3.3" {
		t.Fatalf("real: %q", got)
	}
	r.Header.Set("CF-Connecting-IP", "2.2.2.2")
	if got := ClientKey(r); got != "2.2.2.2" {
		t.Fatalf("cf: %q", got)
	}
	r.Header.Set("X-Forwarded-For", "1.1.1.1, 9.9.9.9")
	if got := ClientKey(r); got != "1.1.1.1" {
		t.Fatalf("xff: %q", got)
	}
	r.Header.Set("X-Forwarded-For", " , 9.9.9.9")
	if got := ClientKey(r); got != "2.2.2.2" {
		t.Fatalf("empty first hop falls through: %q", got)
	}
	r2 := httptest.NewRequest("GET", "/", nil)
	r2.RemoteAddr = ""
	if got := ClientKey(r2); got != "anonymous" {
		t.Fatalf("anon: %q", got)
	}
}

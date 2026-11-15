package players

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"sync"
	"testing"
)

func TestParseUsernameRegistrationNormalizesWhitespace(t *testing.T) {
	got, err := ParseUsernameRegistration("  Acme   Cloud  ")
	if err != nil || got.Username != "Acme Cloud" || got.NormalizedUsername != "acme cloud" {
		t.Fatalf("%+v %v", got, err)
	}
}

func TestParseUsernameRegistrationErrors(t *testing.T) {
	cases := []struct{ in, msg string }{
		{"ab", "Username must be at least 3 characters long."},
		{"  a  ", "Username must be at least 3 characters long."},
		{strings.Repeat("x", 25), "Username must be at most 24 characters long."},
		{"Acme🚀", "Username may only contain letters, numbers, spaces, periods, underscores, and hyphens."},
		{"-abc", "Username may only contain letters, numbers, spaces, periods, underscores, and hyphens."},
		{"abc_", "Username may only contain letters, numbers, spaces, periods, underscores, and hyphens."},
		{"aéc", "Username may only contain letters, numbers, spaces, periods, underscores, and hyphens."},
	}
	for _, c := range cases {
		_, err := ParseUsernameRegistration(c.in)
		var ve *UsernameValidationError
		if !errors.As(err, &ve) || ve.Message != c.msg || ve.Code != "INVALID_USERNAME" {
			t.Errorf("%q: %v", c.in, err)
		}
	}
}

func TestEmojiCountsAsUTF16Units(t *testing.T) {
	// 12 rockets = 24 UTF-16 units (<=24) but fail on pattern; 13 = 26 units -> too long.
	_, err := ParseUsernameRegistration(strings.Repeat("🚀", 13))
	if err == nil || !strings.Contains(err.Error(), "at most 24") {
		t.Fatalf("%v", err)
	}
}

func TestNFKCAndUnicodeWhitespace(t *testing.T) {
	// fullwidth letters fold under NFKC; NBSP/ideographic spaces collapse like JS \s.
	got, err := ParseUsernameRegistration("\u00a0" + string(rune(0xFEFF)) + "\uff21cme\u3000\u2003Cloud\u2028")
	if err != nil || got.Username != "Acme Cloud" {
		t.Fatalf("%+v %v", got, err)
	}
}

func TestNormalizedCollision(t *testing.T) {
	a, _ := ParseUsernameRegistration("John Doe123")
	b, _ := ParseUsernameRegistration("  john   doe123  ")
	if a.NormalizedUsername != b.NormalizedUsername {
		t.Fatal("mismatch")
	}
}

func TestGeneratePlayerID(t *testing.T) {
	re := regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
	if id := GeneratePlayerID(); !re.MatchString(id) {
		t.Fatal(id)
	}
}

func TestServiceAndRepository(t *testing.T) {
	ctx := context.Background()
	repo := NewInMemoryPlayersRepository()
	av, err := CheckUsernameAvailability(ctx, repo, "  Acme  Cloud ")
	if err != nil || av.Username != "Acme Cloud" || !av.Available {
		t.Fatalf("%+v %v", av, err)
	}
	reg, err := RegisterPlayerUsername(ctx, repo, "Acme Cloud")
	if err != nil || reg.Username != "Acme Cloud" || reg.PlayerID == "" {
		t.Fatalf("%+v %v", reg, err)
	}
	av, _ = CheckUsernameAvailability(ctx, repo, "ACME cloud")
	if av.Available || av.Username != "ACME cloud" {
		t.Fatalf("%+v", av)
	}
	_, err = RegisterPlayerUsername(ctx, repo, "acme   CLOUD")
	var se *StatusError
	if !errors.As(err, &se) || se.Status != 409 || se.Code != "USERNAME_UNAVAILABLE" || se.Message != DefaultUsernameUnavailableMessage {
		t.Fatalf("%v", err)
	}
	_, err = RegisterPlayerUsername(ctx, repo, "x")
	if !errors.As(err, &se) || se.Status != 400 || se.Code != "INVALID_USERNAME" {
		t.Fatalf("%v", err)
	}
	p, _ := repo.FindByPlayerID(ctx, reg.PlayerID)
	if p == nil || p.NormalizedUsername != "acme cloud" {
		t.Fatalf("%+v", p)
	}
	before := p.LastSeenAt
	if err := repo.TouchPlayer(ctx, reg.PlayerID, before.Add(5)); err != nil {
		t.Fatal(err)
	}
	p2, _ := repo.FindByPlayerID(ctx, reg.PlayerID)
	if !p2.LastSeenAt.After(before) {
		t.Fatal("not touched")
	}
	if nf, _ := repo.FindByPlayerID(ctx, "nope"); nf != nil {
		t.Fatal("expected nil")
	}
	if err := repo.TouchPlayer(ctx, "nope", before); err != nil {
		t.Fatal(err)
	}
}

func TestConcurrentRegistration(t *testing.T) {
	repo := NewInMemoryPlayersRepository()
	var wg sync.WaitGroup
	var mu sync.Mutex
	ok := 0
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := RegisterPlayerUsername(context.Background(), repo, "Same Name"); err == nil {
				mu.Lock()
				ok++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()
	if ok != 1 {
		t.Fatalf("%d registrations succeeded", ok)
	}
}

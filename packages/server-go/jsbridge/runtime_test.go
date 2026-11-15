package jsbridge

import (
	"encoding/json"
	"os"
	"strings"
	"sync"
	"testing"
)

type golden struct {
	Desc        json.RawMessage   `json:"desc"`
	Actions     []json.RawMessage `json:"actions"`
	GenesisHash string            `json:"genesisHash"`
	StateHash   string            `json:"stateHash"`
	Summary     Summary           `json:"summary"`
	CanonLen    int               `json:"canonLen"`
}

func loadGolden(t *testing.T) golden {
	t.Helper()
	b, err := os.ReadFile("../testdata/jsbridge-golden.json")
	if err != nil {
		t.Fatal(err)
	}
	var g golden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatal(err)
	}
	return g
}

func newRT(t *testing.T) *Runtime {
	t.Helper()
	rt, err := New(2)
	if err != nil {
		t.Fatal(err)
	}
	return rt
}

func TestMetadata(t *testing.T) {
	rt := newRT(t)
	if rt.Version() == "" {
		t.Fatal("empty version")
	}
	want := []string{"money", "cumulativeRevenue", "totalServers", "computeCapacity", "memoryCapacity", "storageCapacity", "gpuCapacity"}
	if strings.Join(rt.MetricKeys(), ",") != strings.Join(want, ",") {
		t.Fatalf("metric keys %v", rt.MetricKeys())
	}
	if len(rt.ActionTypes()) == 0 {
		t.Fatal("no action types")
	}
}

func TestGoldenParityWithBun(t *testing.T) {
	g := loadGolden(t)
	rt := newRT(t)
	state, err := rt.Genesis(g.Desc)
	if err != nil {
		t.Fatal(err)
	}
	h, err := rt.SHA256Canonical(state)
	if err != nil {
		t.Fatal(err)
	}
	if h != g.GenesisHash {
		t.Fatalf("genesis hash %s != %s", h, g.GenesisHash)
	}
	res, err := rt.Replay(state, g.Actions)
	if err != nil {
		t.Fatal(err)
	}
	canon, _ := rt.CanonicalJSON(res.State)
	t.Logf("final state canon len %d (golden canonLen %d)", len(canon), g.CanonLen)
	sh, _ := rt.SHA256Canonical(res.State)
	if sh != g.StateHash {
		t.Fatalf("state hash %s != %s", sh, g.StateHash)
	}
	if res.Summary != g.Summary {
		t.Fatalf("summary %+v != %+v", res.Summary, g.Summary)
	}
	sum, err := rt.Summarize(res.State)
	if err != nil || sum != g.Summary {
		t.Fatalf("summarize %+v %v", sum, err)
	}
}

func TestCanonicalJSON(t *testing.T) {
	rt := newRT(t)
	got, err := rt.CanonicalJSON(map[string]any{"b": 1, "a": []any{map[string]any{"z": nil, "y": true}}, "B": "x"})
	if err != nil {
		t.Fatal(err)
	}
	// localeCompare ordering (same as Bun/JSC): a < b < B
	if got != `{"a":[{"y":true,"z":null}],"b":1,"B":"x"}` {
		t.Fatalf("got %s", got)
	}
	// request-hash shaped values: nil parent -> null
	if _, err := rt.SHA256Canonical(map[string]any{"parentHeadHash": nil, "actions": []any{}}); err != nil {
		t.Fatal(err)
	}
}

func TestReplayErrorCarriesJSMessage(t *testing.T) {
	g := loadGolden(t)
	rt := newRT(t)
	state, _ := rt.Genesis(g.Desc)
	_, err := rt.Replay(state, []map[string]any{{"type": "PlaceRack", "dcId": "nope", "specId": "x", "row": 0, "position": 0, "placementId": "p"}})
	var rr *ReplayRejectedError
	if err == nil {
		t.Fatal("expected error")
	}
	if !asReplay(err, &rr) || rr.Message == "" {
		t.Fatalf("expected ReplayRejectedError with message, got %v", err)
	}
	t.Logf("js message: %q", rr.Message)
}

func asReplay(err error, out **ReplayRejectedError) bool {
	r, ok := err.(*ReplayRejectedError)
	if ok {
		*out = r
	}
	return ok
}

func TestTotalCapacity(t *testing.T) {
	rt := newRT(t)
	n, err := rt.TotalCapacity(map[string]any{"money": 1, "cumulativeRevenue": 1, "totalServers": 1, "computeCapacity": 1, "memoryCapacity": 2, "storageCapacity": 3, "gpuCapacity": 4})
	if err != nil || n != 10 {
		t.Fatalf("%v %v", n, err)
	}
}

func TestConcurrentUse(t *testing.T) {
	g := loadGolden(t)
	rt := newRT(t)
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			state, err := rt.Genesis(g.Desc)
			if err != nil {
				t.Error(err)
				return
			}
			h, err := rt.SHA256Canonical(state)
			if err != nil || h != g.GenesisHash {
				t.Errorf("hash %s %v", h, err)
			}
		}()
	}
	wg.Wait()
}

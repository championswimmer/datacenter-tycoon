// Package jsbridge embeds a bundle of @datacenter-tycoon/game-logic and runs it in goja.
// Game rules stay in TypeScript; Go only calls the DT.* entry points over JSON strings.
package jsbridge

import (
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"runtime"
	"sync"

	"github.com/dop251/goja"
)

//go:embed bundle.js
var bundleSource string

var (
	programOnce sync.Once
	program     *goja.Program
	programErr  error
)

func compiled() (*goja.Program, error) {
	programOnce.Do(func() {
		program, programErr = goja.Compile("bundle.js", bundleSource, false)
	})
	return program, programErr
}

// ReplayRejectedError carries the JS exception message thrown during replay,
// exactly as `error.message` would be seen by the TS server.
type ReplayRejectedError struct{ Message string }

func (e *ReplayRejectedError) Error() string { return e.Message }

// Summary mirrors LeaderboardStateSummary. Metrics are integral.
type Summary struct {
	GameID    string  `json:"gameId"`
	GameMonth int     `json:"gameMonth"`
	Metrics   Metrics `json:"metrics"`
}

// Metrics has the exact JSON keys of LEADERBOARD_METRIC_KEYS.
type Metrics struct {
	Money             int64 `json:"money"`
	CumulativeRevenue int64 `json:"cumulativeRevenue"`
	TotalServers      int64 `json:"totalServers"`
	ComputeCapacity   int64 `json:"computeCapacity"`
	MemoryCapacity    int64 `json:"memoryCapacity"`
	StorageCapacity   int64 `json:"storageCapacity"`
	GpuCapacity       int64 `json:"gpuCapacity"`
}

// ReplayResult is the outcome of a successful replay. State is the JSON of the new GameState.
type ReplayResult struct {
	State   json.RawMessage
	Summary Summary
}

type vm struct {
	rt *goja.Runtime
	fn map[string]goja.Callable
}

// Runtime is a concurrency-safe pool of goja VMs (a goja.Runtime is not goroutine safe).
type Runtime struct {
	pool chan *vm
	meta struct {
		version     string
		metricKeys  []string
		actionTypes []string
	}
}

// New creates a Runtime with a pool of size VMs (<=0 means min(GOMAXPROCS, 4)).
// VMs are created eagerly so bundle problems surface here.
func New(size int) (*Runtime, error) {
	if size <= 0 {
		size = runtime.GOMAXPROCS(0)
		if size > 4 {
			size = 4
		}
	}
	r := &Runtime{pool: make(chan *vm, size)}
	for i := 0; i < size; i++ {
		v, err := newVM()
		if err != nil {
			return nil, err
		}
		r.pool <- v
	}
	v := <-r.pool
	defer func() { r.pool <- v }()
	if err := r.loadMeta(v); err != nil {
		return nil, err
	}
	return r, nil
}

var (
	defaultOnce sync.Once
	defaultRT   *Runtime
	defaultErr  error
)

// Default returns a lazily created shared Runtime.
func Default() (*Runtime, error) {
	defaultOnce.Do(func() { defaultRT, defaultErr = New(0) })
	return defaultRT, defaultErr
}

func newVM() (*vm, error) {
	p, err := compiled()
	if err != nil {
		return nil, fmt.Errorf("jsbridge: compile bundle: %w", err)
	}
	rt := goja.New()
	if _, err := rt.RunProgram(p); err != nil {
		return nil, fmt.Errorf("jsbridge: run bundle: %w", err)
	}
	dt, ok := rt.Get("DT").(*goja.Object)
	if !ok {
		return nil, errors.New("jsbridge: bundle did not define DT")
	}
	v := &vm{rt: rt, fn: map[string]goja.Callable{}}
	for _, name := range []string{"canonicalJson", "genesis", "replay", "summarize", "totalCapacity"} {
		f, ok := goja.AssertFunction(dt.Get(name))
		if !ok {
			return nil, fmt.Errorf("jsbridge: DT.%s is not a function", name)
		}
		v.fn[name] = f
	}
	return v, nil
}

func (r *Runtime) loadMeta(v *vm) error {
	dt := v.rt.Get("DT").(*goja.Object)
	r.meta.version = dt.Get("version").String()
	if err := v.rt.ExportTo(dt.Get("metricKeys"), &r.meta.metricKeys); err != nil {
		return err
	}
	return v.rt.ExportTo(dt.Get("actionTypes"), &r.meta.actionTypes)
}

// call invokes DT.<name> with string args on a pooled VM.
func (r *Runtime) call(name string, args ...string) (goja.Value, *vm, error) {
	v := <-r.pool
	jsArgs := make([]goja.Value, len(args))
	for i, a := range args {
		jsArgs[i] = v.rt.ToValue(a)
	}
	res, err := v.fn[name](goja.Undefined(), jsArgs...)
	return res, v, err
}

func (r *Runtime) callString(name string, args ...string) (string, error) {
	res, v, err := r.call(name, args...)
	defer func() { r.pool <- v }()
	if err != nil {
		return "", jsError(err)
	}
	return res.String(), nil
}

func jsError(err error) error {
	var ex *goja.Exception
	if errors.As(err, &ex) {
		if o, ok := ex.Value().(*goja.Object); ok {
			if m := o.Get("message"); m != nil && !goja.IsUndefined(m) {
				return errors.New(m.String())
			}
		}
		return errors.New(ex.Value().String())
	}
	return err
}

// Version is game-logic's VERSION.
func (r *Runtime) Version() string { return r.meta.version }

// MetricKeys is LEADERBOARD_METRIC_KEYS.
func (r *Runtime) MetricKeys() []string { return append([]string(nil), r.meta.metricKeys...) }

// ActionTypes is LEADERBOARD_VERIFICATION_ACTION_TYPES.
func (r *Runtime) ActionTypes() []string { return append([]string(nil), r.meta.actionTypes...) }

func toJSON(v any) ([]byte, error) {
	switch t := v.(type) {
	case json.RawMessage:
		return t, nil
	case []byte:
		return t, nil
	case string:
		return json.Marshal(t)
	}
	return json.Marshal(v)
}

// CanonicalJSON returns the canonical JSON (sorted keys via JS localeCompare,
// undefined filtered, non-finite numbers rejected) of any JSON-marshalable value.
func (r *Runtime) CanonicalJSON(value any) (string, error) {
	b, err := toJSON(value)
	if err != nil {
		return "", err
	}
	return r.callString("canonicalJson", string(b))
}

// SHA256Canonical is hex(sha256(canonicalJson(value))).
func (r *Runtime) SHA256Canonical(value any) (string, error) {
	c, err := r.CanonicalJSON(value)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256([]byte(c))
	return hex.EncodeToString(sum[:]), nil
}

// Genesis runs createVerifiedGenesisState(descriptor) and returns the state JSON.
func (r *Runtime) Genesis(descriptor any) (json.RawMessage, error) {
	b, err := toJSON(descriptor)
	if err != nil {
		return nil, err
	}
	s, err := r.callString("genesis", string(b))
	if err != nil {
		return nil, err
	}
	return json.RawMessage(s), nil
}

// Replay applies actions to state. A JS exception during replay yields *ReplayRejectedError
// whose Message equals the JS error message.
func (r *Runtime) Replay(state, actions any) (*ReplayResult, error) {
	sb, err := toJSON(state)
	if err != nil {
		return nil, err
	}
	ab, err := toJSON(actions)
	if err != nil {
		return nil, err
	}
	out, err := r.callString("replay", string(sb), string(ab))
	if err != nil {
		return nil, err
	}
	var env struct {
		OK      bool            `json:"ok"`
		Message string          `json:"message"`
		State   json.RawMessage `json:"state"`
		Summary Summary         `json:"summary"`
	}
	if err := json.Unmarshal([]byte(out), &env); err != nil {
		return nil, fmt.Errorf("jsbridge: decode replay result: %w", err)
	}
	if !env.OK {
		return nil, &ReplayRejectedError{Message: env.Message}
	}
	return &ReplayResult{State: env.State, Summary: env.Summary}, nil
}

// Summarize runs summarizeLeaderboardFromState(state).
func (r *Runtime) Summarize(state any) (Summary, error) {
	b, err := toJSON(state)
	if err != nil {
		return Summary{}, err
	}
	s, err := r.callString("summarize", string(b))
	if err != nil {
		return Summary{}, err
	}
	var out Summary
	if err := json.Unmarshal([]byte(s), &out); err != nil {
		return Summary{}, fmt.Errorf("jsbridge: decode summary: %w", err)
	}
	return out, nil
}

// TotalCapacity runs totalLeaderboardCapacity(metrics).
func (r *Runtime) TotalCapacity(metrics any) (float64, error) {
	b, err := toJSON(metrics)
	if err != nil {
		return 0, err
	}
	res, v, err := r.call("totalCapacity", string(b))
	defer func() { r.pool <- v }()
	if err != nil {
		return 0, jsError(err)
	}
	return res.ToFloat(), nil
}

package leaderboard

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"math"
	"sort"
	"strconv"
)

// Object is a decoded JSON object that preserves JS Object.keys ordering
// (array-index keys ascending first, then insertion order), which is observable in
// the "Unsupported field(s): ..." validation message.
type Object struct {
	keys   []string
	values map[string]any
}

// NewObject builds an Object from key/value pairs given in insertion order.
func NewObject(pairs ...any) *Object {
	o := &Object{values: map[string]any{}}
	for i := 0; i+1 < len(pairs); i += 2 {
		o.Set(pairs[i].(string), pairs[i+1])
	}
	return o
}

// Set adds or replaces a key (replacement keeps the original position, as in JS).
func (o *Object) Set(k string, v any) {
	if _, ok := o.values[k]; !ok {
		o.keys = append(o.keys, k)
	}
	o.values[k] = v
}

// Get returns the value and whether the key is present.
func (o *Object) Get(k string) (any, bool) { v, ok := o.values[k]; return v, ok }

// Keys returns keys in JS Object.keys order.
func (o *Object) Keys() []string {
	var idx, rest []string
	for _, k := range o.keys {
		if isArrayIndex(k) {
			idx = append(idx, k)
		} else {
			rest = append(rest, k)
		}
	}
	sort.SliceStable(idx, func(i, j int) bool {
		a, _ := strconv.ParseUint(idx[i], 10, 64)
		b, _ := strconv.ParseUint(idx[j], 10, 64)
		return a < b
	})
	return append(idx, rest...)
}

func isArrayIndex(k string) bool {
	if k == "" || (len(k) > 1 && k[0] == '0') {
		return false
	}
	for _, c := range k {
		if c < '0' || c > '9' {
			return false
		}
	}
	n, err := strconv.ParseUint(k, 10, 64)
	return err == nil && n < math.MaxUint32
}

// DecodeJSON decodes a JSON document like JSON.parse: objects become *Object
// (ordered), arrays []any, numbers float64 (out-of-range becomes +-Inf), plus
// string/bool/nil. Trailing non-whitespace data is an error.
func DecodeJSON(raw []byte) (any, error) {
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	v, err := decodeValue(dec)
	if err != nil {
		return nil, err
	}
	if _, err := dec.Token(); err != io.EOF {
		return nil, errors.New("unexpected data after JSON value")
	}
	return v, nil
}

func decodeValue(dec *json.Decoder) (any, error) {
	tok, err := dec.Token()
	if err != nil {
		return nil, err
	}
	switch t := tok.(type) {
	case json.Delim:
		switch t {
		case '{':
			o := &Object{values: map[string]any{}}
			for dec.More() {
				kt, err := dec.Token()
				if err != nil {
					return nil, err
				}
				v, err := decodeValue(dec)
				if err != nil {
					return nil, err
				}
				o.Set(kt.(string), v)
			}
			if _, err := dec.Token(); err != nil {
				return nil, err
			}
			return o, nil
		case '[':
			arr := []any{}
			for dec.More() {
				v, err := decodeValue(dec)
				if err != nil {
					return nil, err
				}
				arr = append(arr, v)
			}
			if _, err := dec.Token(); err != nil {
				return nil, err
			}
			return arr, nil
		}
	case json.Number:
		f, _ := strconv.ParseFloat(string(t), 64) // ErrRange yields +-Inf like JS
		return f, nil
	}
	return tok, nil // string, bool, nil
}

// asObject normalizes accepted object representations.
func asObject(v any) (*Object, bool) {
	switch t := v.(type) {
	case *Object:
		return t, t != nil
	case map[string]any:
		o := &Object{values: t}
		for k := range t {
			o.keys = append(o.keys, k)
		}
		sort.Strings(o.keys)
		return o, true
	}
	return nil, false
}

func asNumber(v any) (float64, bool) {
	switch t := v.(type) {
	case float64:
		return t, true
	case int:
		return float64(t), true
	case int64:
		return float64(t), true
	case json.Number:
		f, err := t.Float64()
		return f, err == nil || true
	}
	return 0, false
}

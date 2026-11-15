package leaderboard

import (
	"fmt"
	"math"
	"regexp"
	"strings"

	"github.com/championswimmer/datacenter-tycoon/server-go/internal/players"
)

var (
	clientRunIDPattern = regexp.MustCompile(`^[A-Za-z0-9._:-]{1,128}$`)
	hashPattern        = regexp.MustCompile(`^[a-f0-9]{64}$`)
	rulesetIDPattern   = regexp.MustCompile(`^[A-Za-z0-9._:-]{1,128}$`)
)

// VerificationActionTypes mirrors LEADERBOARD_VERIFICATION_ACTION_TYPES (game-logic).
// A test asserts it equals the bundled runtime's list.
var VerificationActionTypes = []string{
	"BuildDatacenter", "PlaceRack", "RemoveRack", "MoveRack", "AcceptContract",
	"CancelContract", "FabricLink", "UpgradeDatacenter", "SetMaintenanceStaff", "Subtick", "Tick",
}

type fieldKind int

const (
	fString fieldKind = iota // bounded string (<=128)
	fInt                     // small integer 0..10000
)

type actionField struct {
	name string
	kind fieldKind
}

var actionSchemas = map[string][]actionField{
	"BuildDatacenter":     {{"specId", fString}, {"dcId", fString}, {"regionId", fString}},
	"PlaceRack":           {{"dcId", fString}, {"specId", fString}, {"row", fInt}, {"position", fInt}, {"placementId", fString}},
	"RemoveRack":          {{"dcId", fString}, {"placementId", fString}},
	"MoveRack":            {{"dcId", fString}, {"placementId", fString}, {"targetDcId", fString}, {"row", fInt}, {"position", fInt}},
	"AcceptContract":      {{"contractId", fString}, {"dcId", fString}},
	"CancelContract":      {{"contractId", fString}},
	"FabricLink":          {{"sourceDcId", fString}, {"targetDcId", fString}},
	"UpgradeDatacenter":   {{"dcId", fString}, {"trackId", fString}, {"targetNodeId", fString}},
	"SetMaintenanceStaff": {{"dcId", fString}, {"maintenanceStaff", fInt}},
	"Subtick":             nil,
	"Tick":                nil,
}

// ParseVerifiedRunCheckpointSubmission mirrors validation.ts. payload is the
// result of DecodeJSON (or equivalent generic Go JSON values). Errors are *ValidationError.
func ParseVerifiedRunCheckpointSubmission(payload any) (*VerifiedRunCheckpointSubmission, error) {
	record, ok := asObject(payload)
	if !ok {
		return nil, NewValidationError("Verified leaderboard submission must be a JSON object.")
	}
	if err := assertOnlyKeys(record, []string{"playerId", "clientRunId", "genesis", "parentHeadHash", "actions"}); err != nil {
		return nil, err
	}
	if _, has := record.Get("metrics"); has {
		return nil, metricsForbidden()
	}
	if _, has := record.Get("gameMonth"); has {
		return nil, metricsForbidden()
	}

	get := func(k string) any { v, _ := record.Get(k); return v }

	playerID, err := parseRequiredString(get("playerId"), "playerId")
	if err != nil {
		return nil, err
	}
	clientRunID, err := parseClientRunID(get("clientRunId"))
	if err != nil {
		return nil, err
	}
	genesis, err := parseOptionalGenesis(record)
	if err != nil {
		return nil, err
	}
	parent, err := parseParentHeadHash(record)
	if err != nil {
		return nil, err
	}
	actions, err := parseActions(record)
	if err != nil {
		return nil, err
	}
	return &VerifiedRunCheckpointSubmission{
		PlayerID: playerID, ClientRunID: clientRunID, Genesis: genesis, ParentHeadHash: parent, Actions: actions,
	}, nil
}

func metricsForbidden() error {
	return NewValidationError("Verified leaderboard submissions must not include client-computed metrics or gameMonth.")
}

// In JS, a missing key and an explicit undefined are identical; JSON has no undefined,
// so "missing" == undefined here and an explicit null is a distinct value.

func parseOptionalGenesis(record *Object) (*VerifiedRunCheckpointGenesis, error) {
	value, present := record.Get("genesis")
	if !present {
		return nil, nil
	}
	g, ok := asObject(value)
	if !ok {
		return nil, NewValidationError("genesis must be an object when provided.")
	}
	if err := assertOnlyKeys(g, []string{"seed", "difficulty", "rulesetId"}); err != nil {
		return nil, err
	}
	gv := func(k string) any { v, _ := g.Get(k); return v }
	seed, err := parseSeed(gv("seed"))
	if err != nil {
		return nil, err
	}
	difficulty, err := parseDifficulty(gv("difficulty"))
	if err != nil {
		return nil, err
	}
	rulesetID, err := parseRulesetID(gv("rulesetId"))
	if err != nil {
		return nil, err
	}
	return &VerifiedRunCheckpointGenesis{Seed: seed, Difficulty: difficulty, RulesetID: rulesetID}, nil
}

func parseActions(record *Object) ([]Action, error) {
	value, _ := record.Get("actions")
	arr, ok := value.([]any)
	if !ok {
		return nil, NewValidationError("actions must be an array.")
	}
	out := make([]Action, 0, len(arr))
	for i, a := range arr {
		act, err := parseAction(a, i)
		if err != nil {
			return nil, err
		}
		out = append(out, act)
	}
	return out, nil
}

func parseAction(value any, index int) (Action, error) {
	record, ok := asObject(value)
	if !ok {
		return nil, NewValidationError(fmt.Sprintf("actions[%d] must be an object.", index))
	}
	rawType, _ := record.Get("type")
	typ, err := parseRequiredString(rawType, fmt.Sprintf("actions[%d].type", index))
	if err != nil {
		return nil, err
	}
	schema, known := actionSchemas[typ]
	if !known {
		return nil, NewValidationError(fmt.Sprintf("actions[%d].type is unsupported: %s", index, typ))
	}
	allowed := []string{"type"}
	for _, f := range schema {
		allowed = append(allowed, f.name)
	}
	if err := assertOnlyKeys(record, allowed); err != nil {
		return nil, err
	}
	out := Action{"type": typ}
	for _, f := range schema {
		v, _ := record.Get(f.name)
		field := fmt.Sprintf("actions[%d].%s", index, f.name)
		switch f.kind {
		case fString:
			s, err := parseBoundedString(v, field)
			if err != nil {
				return nil, err
			}
			out[f.name] = s
		case fInt:
			n, err := parseSmallInteger(v, field)
			if err != nil {
				return nil, err
			}
			out[f.name] = n
		}
	}
	return out, nil
}

func parseRequiredString(value any, field string) (string, error) {
	s, ok := value.(string)
	if !ok {
		return "", NewValidationError(field + " must be a string.")
	}
	t := players.JSTrim(s)
	if len(t) == 0 {
		return "", NewValidationError(field + " is required.")
	}
	return t, nil
}

func parseClientRunID(value any) (string, error) {
	id, err := parseRequiredString(value, "clientRunId")
	if err != nil {
		return "", err
	}
	if !clientRunIDPattern.MatchString(id) {
		return "", NewValidationError("clientRunId may only contain letters, numbers, periods, underscores, colons, and hyphens.")
	}
	return id, nil
}

func parseParentHeadHash(record *Object) (*string, error) {
	value, present := record.Get("parentHeadHash")
	if present && value == nil {
		return nil, nil
	}
	h, err := parseRequiredString(value, "parentHeadHash")
	if err != nil {
		return nil, err
	}
	if !hashPattern.MatchString(h) {
		return nil, NewValidationError("parentHeadHash must be a 64-character lowercase hex SHA-256 digest or null.")
	}
	return &h, nil
}

func parseRulesetID(value any) (string, error) {
	id, err := parseRequiredString(value, "genesis.rulesetId")
	if err != nil {
		return "", err
	}
	if !rulesetIDPattern.MatchString(id) {
		return "", NewValidationError("genesis.rulesetId contains unsupported characters.")
	}
	return id, nil
}

const maxSafeInteger = 9007199254740991

func isSafeInteger(f float64) bool {
	return !math.IsNaN(f) && math.Abs(f) <= maxSafeInteger && f == math.Trunc(f)
}

func parseSeed(value any) (int64, error) {
	f, ok := asNumber(value)
	if !ok || !isSafeInteger(f) || f < 0 || f > 0xffff_ffff {
		return 0, NewValidationError("genesis.seed must be a non-negative 32-bit safe integer.")
	}
	return int64(f), nil
}

func parseDifficulty(value any) (string, error) {
	s, ok := value.(string)
	if !ok || (s != "easy" && s != "hard") {
		return "", NewValidationError("genesis.difficulty must be one of: easy, hard.")
	}
	return s, nil
}

func parseBoundedString(value any, field string) (string, error) {
	s, err := parseRequiredString(value, field)
	if err != nil {
		return "", err
	}
	if players.UTF16Len(s) > 128 {
		return "", NewValidationError(field + " must be at most 128 characters.")
	}
	return s, nil
}

func parseSmallInteger(value any, field string) (int64, error) {
	f, ok := asNumber(value)
	if !ok || !isSafeInteger(f) || f < 0 || f > 10_000 {
		return 0, NewValidationError(field + " must be a safe integer between 0 and 10000.")
	}
	return int64(f), nil
}

func assertOnlyKeys(record *Object, allowed []string) error {
	var unknown []string
	for _, k := range record.Keys() {
		found := false
		for _, a := range allowed {
			if a == k {
				found = true
				break
			}
		}
		if !found {
			unknown = append(unknown, k)
		}
	}
	if len(unknown) > 0 {
		return NewValidationError("Unsupported field(s): " + strings.Join(unknown, ", "))
	}
	return nil
}

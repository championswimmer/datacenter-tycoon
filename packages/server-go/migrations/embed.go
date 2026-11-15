// Package migrations embeds the SQL migrations shared with packages/server
// (kept byte-identical; see migrations_test.go) and the Drizzle journal.
package migrations

import "embed"

// FS contains the legacy baseline *.sql files at its root and the Drizzle
// journal at drizzle/meta/_journal.json.
//
//go:embed *.sql drizzle/meta/_journal.json
var FS embed.FS

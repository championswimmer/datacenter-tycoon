package httpserver

import (
	"net/http"
	"sort"
	"strings"
)

// The TS server registers @elysiajs/cors with an explicit origin list, methods GET/POST/OPTIONS and
// allowedHeaders "content-type, x-forwarded-for". The plugin has several observable quirks that are
// replicated here (verified against the real plugin):
//
//   - access-control-allow-credentials: true, access-control-allow-headers and vary: Origin are sent
//     on every response (including errors/404/429), with or without an Origin header.
//   - access-control-allow-origin is only echoed when the Origin matches the allowlist.
//   - access-control-allow-methods is sent on every non-preflight response; on preflight only when
//     the access-control-request-method header is present.
//   - access-control-expose-headers is the list of REQUEST header names (", " separated on normal
//     requests, "," separated on preflight). Go does not preserve wire order, so names are emitted
//     with "host" first and the rest sorted.
//   - OPTIONS requests are answered 204 with max-age 5 before any rate limiting or routing.
const (
	corsAllowHeaders = "content-type, x-forwarded-for"
	corsAllowMethods = "GET, POST, OPTIONS"
	corsMaxAge       = "5"
)

type corsPolicy struct {
	origins []string
	set     map[string]bool
}

func newCORSPolicy(origins []string) *corsPolicy {
	p := &corsPolicy{origins: origins, set: map[string]bool{}}
	for _, o := range origins {
		p.set[o] = true
	}
	return p
}

// matches mirrors the plugin's processOrigin for string origins.
func (p *corsPolicy) matches(from string) bool {
	if p.set[from] {
		return true
	}
	if i := strings.Index(from, "://"); i != -1 {
		from = from[i+3:]
	}
	for _, o := range p.origins {
		if o == from {
			return true
		}
	}
	return false
}

func requestHeaderNames(r *http.Request) []string {
	names := make([]string, 0, len(r.Header)+1)
	for k := range r.Header {
		names = append(names, strings.ToLower(k))
	}
	sort.Strings(names)
	return append([]string{"host"}, names...)
}

// apply writes the CORS headers for r onto h. It reports whether r is a preflight (OPTIONS) request.
func (p *corsPolicy) apply(h http.Header, r *http.Request) (preflight bool) {
	h.Set("Access-Control-Allow-Headers", corsAllowHeaders)
	h.Set("Access-Control-Allow-Credentials", "true")
	h.Set("Vary", "Origin")
	if from := r.Header.Get("Origin"); from != "" && p.matches(from) {
		h.Set("Access-Control-Allow-Origin", from)
	}

	names := requestHeaderNames(r)
	if r.Method == http.MethodOptions {
		if r.Header.Get("Access-Control-Request-Method") != "" {
			h.Set("Access-Control-Allow-Methods", corsAllowMethods)
		}
		h.Set("Access-Control-Expose-Headers", strings.Join(names, ","))
		h.Set("Access-Control-Max-Age", corsMaxAge)
		return true
	}
	h.Set("Access-Control-Allow-Methods", corsAllowMethods)
	h.Set("Access-Control-Expose-Headers", strings.Join(names, ", "))
	return false
}

# syntax=docker/dockerfile:1
#
# Build context must be the REPO ROOT. The Go module lives in packages/server-go and needs nothing else
# from the monorepo; the game-logic bundle is committed as jsbridge/bundle.js, so no Node stage runs.
#   docker build -f packages/server-go/Dockerfile .

FROM golang:1.26 AS build
WORKDIR /src
ENV CGO_ENABLED=0 GOFLAGS=-trimpath

COPY packages/server-go/go.mod packages/server-go/go.sum ./
RUN go mod download

COPY packages/server-go/ ./
RUN go build -ldflags="-s -w" -o /out/server ./cmd/server \
 && go build -ldflags="-s -w" -o /out/migrate ./cmd/migrate

FROM alpine:3.22 AS runtime
# ca-certificates for TLS to managed Postgres. Alpine (not distroless) keeps a shell so Railway's
# pre-deploy and start commands work whether or not the platform wraps them in sh.
RUN apk add --no-cache ca-certificates \
 && adduser -D -u 10001 app
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY --from=build /out/server /app/server
COPY --from=build /out/migrate /app/migrate

USER app
EXPOSE 3000
CMD ["/app/server"]

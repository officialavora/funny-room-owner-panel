#!/usr/bin/env bash
set -euo pipefail
# Docker Official Image postgres17 linux/amd64, docker-library/repo-info 17.md
IMAGE='postgres@sha256:0b81cec82228160abfa753aeaad0609b709eb26eeb950f2e404ad2326e1cc370'
NAME="funnyroom-reset-admission-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
DB='funnyroom_reset_admission_ci'
SQL='tests/reset-admission/admission.sql'
printf '%s  %s\n' dc72effe02cdfb0d949cd1048678a222e654a3a3af6617cb9287c02c7252efe6 "$SQL" | sha256sum -c -
printf '%s  %s\n' 0c6f14a6e1c65ea85452b5b81152b3df41f45f734f3b752b241dd6f28d84bd00 tests/reset-admission/category-null-guard.sql | sha256sum -c -
cleanup() { docker rm -fv "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
# Image is fetched before the disconnected container is created. No repository secrets.
docker pull --platform linux/amd64 "$IMAGE"
docker image inspect "$IMAGE" --format '{{.Id}} {{.Architecture}} {{json .RepoDigests}}'
docker run -d --name "$NAME" --network none --platform linux/amd64 \
  --tmpfs /var/lib/postgresql/data:rw,size=256m \
  -e POSTGRES_DB="$DB" -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=synthetic-fixture-only -e POSTGRES_HOST_AUTH_METHOD=reject \
  "$IMAGE" postgres -c listen_addresses='' >/dev/null
docker inspect "$NAME" --format '{{json .HostConfig.NetworkMode}} {{json .HostConfig.PortBindings}} {{json .HostConfig.Binds}} {{json .HostConfig.Tmpfs}}'
[[ $(docker inspect "$NAME" --format '{{.HostConfig.NetworkMode}}') == none ]]
[[ $(docker inspect "$NAME" --format '{{len .HostConfig.PortBindings}}') == 0 ]]
[[ $(docker inspect "$NAME" --format '{{len .HostConfig.Binds}}') == 0 ]]
[[ $(docker inspect "$NAME" --format '{{index .HostConfig.Tmpfs "/var/lib/postgresql/data"}}') == "rw,size=256m" ]]
echo ISOLATION_CONFIGURATION_VERIFIED
ready=false
for i in $(seq 1 60); do
  if [[ $(docker exec "$NAME" cat /proc/1/comm 2>/dev/null) == postgres ]] && docker exec "$NAME" pg_isready -U postgres -d "$DB" >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]]
fs_type=$(docker exec "$NAME" stat -f -c %T /var/lib/postgresql/data)
printf 'PGDATA_FILESYSTEM=%s\n' "$fs_type"
[[ "$fs_type" == tmpfs ]]
docker exec "$NAME" psql -X -U postgres -d "$DB" -v ON_ERROR_STOP=1 -Atc 'select version();'
[[ $(docker exec "$NAME" psql -X -U postgres -d "$DB" -Atc 'show listen_addresses') == '' ]]
# Exact unmodified fixture enforces PG17, database name, emptiness,34 outcomes and ROLLBACK.
docker exec -i "$NAME" psql -X -U postgres -d "$DB" -v ON_ERROR_STOP=1 < "$SQL"
docker exec -i "$NAME" psql -X -U postgres -d "$DB" -v ON_ERROR_STOP=1 < tests/reset-admission/category-null-guard.sql
# Separate connection verifies fixture rollback, not production backup/restore.
left=$(docker exec "$NAME" psql -X -U postgres -d "$DB" -v ON_ERROR_STOP=1 -Atc "select (select count(*) from pg_namespace where nspname in ('auth','private','extensions')) + (select count(*) from information_schema.tables where table_schema='public');")
[[ "$left" == 0 ]]
docker rm -fv "$NAME" >/dev/null
if docker inspect "$NAME" >/dev/null 2>&1; then echo 'CLEANUP_FAILED'; exit 1; fi
trap - EXIT
printf '%s\n' 'RESET_ADMISSION_34_AND_CATEGORY_38_PASS_AND_FIXTURE_ROLLBACK_ONLY; live_reset_ready=false'

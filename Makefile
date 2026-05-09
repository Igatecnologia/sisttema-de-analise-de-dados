.PHONY: dev dev-build stop logs test build check db-migrate-pg db-copy-pg deploy

dev:
	docker compose up

dev-build:
	docker compose up --build

stop:
	docker compose down

logs:
	docker compose logs -f

test:
	npm --prefix services/api run test
	npm --prefix apps/web run test:unit

build:
	npm --prefix services/api run build
	npm --prefix apps/web run build

check:
	npm --prefix services/api run lint
	npm --prefix apps/web run check

db-migrate-pg:
	npm --prefix services/api run db:migrate:pg

db-copy-pg:
	npm --prefix services/api run db:copy:pg

deploy:
	@echo "Deploy automatizado entra na Sprint 6. Use render.yaml enquanto o deploy atual for Render."

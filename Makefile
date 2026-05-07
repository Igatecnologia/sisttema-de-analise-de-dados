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
	npm --prefix back-end-gest-o run test
	npm --prefix front-end-gest-o run test:unit

build:
	npm --prefix back-end-gest-o run build
	npm --prefix front-end-gest-o run build

check:
	npm --prefix back-end-gest-o run lint
	npm --prefix front-end-gest-o run check

db-migrate-pg:
	npm --prefix back-end-gest-o run db:migrate:pg

db-copy-pg:
	npm --prefix back-end-gest-o run db:copy:pg

deploy:
	@echo "Deploy automatizado entra na Sprint 6. Use render.yaml enquanto o deploy atual for Render."

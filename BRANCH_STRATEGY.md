# Branch Strategy

Fluxo definido para a fase SaaS:

- `main`: producao. Recebe merges aprovados e tags de release.
- `develop`: staging/homologacao. Base de integracao das features.
- `feature/*`: trabalho incremental por tarefa ou sprint.
- `hotfix/*`: correcao urgente a partir de `main`, merge de volta em `main` e `develop`.

Regras praticas:

- Toda mudanca entra por pull request.
- O CI precisa estar verde antes do merge.
- Branches de feature devem ser pequenas e apagadas apos merge.
- Migrations de banco seguem expand-contract; rollback destrutivo nao e automatico.

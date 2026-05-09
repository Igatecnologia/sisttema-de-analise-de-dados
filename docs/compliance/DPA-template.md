# DPA — Data Processing Agreement (Modelo)

> **Modelo de DPA para clientes Enterprise.** Revisar com advogado antes de oferecer.
> **Versão**: 1.0
> **Data**: 2026-05-08

---

## ACORDO DE TRATAMENTO DE DADOS PESSOAIS

**Entre**:

**[CLIENTE]** — pessoa jurídica inscrita no CNPJ sob nº _[CNPJ]_, com sede em _[endereço]_, doravante denominada **"Controlador"**.

**E**:

**[IGA Gestão LTDA]** — pessoa jurídica inscrita no CNPJ sob nº _[CNPJ]_, com sede em _[endereço]_, doravante denominada **"Operador"**.

Em conjunto denominadas **"Partes"**, celebram o presente Acordo de Tratamento de Dados Pessoais ("DPA"), regido pela Lei nº 13.709/2018 ("LGPD"), nos seguintes termos:

---

### Cláusula 1ª — Objeto

1.1. Este DPA estabelece os termos e condições aplicáveis ao tratamento de dados pessoais realizado pelo Operador em nome do Controlador, no âmbito da prestação dos serviços contratados na plataforma IGA Gestão.

1.2. O presente DPA é parte integrante do Contrato de Prestação de Serviços firmado entre as Partes, prevalecendo em caso de conflito sobre matéria de proteção de dados.

### Cláusula 2ª — Definições

Aplicam-se as definições da LGPD, em especial: **dado pessoal**, **dado pessoal sensível**, **titular**, **controlador**, **operador**, **encarregado**, **tratamento**, **anonimização**, **bloqueio**, **eliminação** e **incidente de segurança**.

### Cláusula 3ª — Objeto do tratamento

3.1. O Operador trata dados pessoais com a finalidade exclusiva de prestar os serviços de business intelligence industrial conforme descritos no Contrato.

3.2. **Categorias de dados pessoais** tratados: nome, e-mail, hash de senha, dados operacionais retornados pela API do ERP do Controlador (que podem incluir nome, CPF/CNPJ e valores financeiros de clientes finais do Controlador).

3.3. **Categorias de titulares**: administradores e usuários cadastrados pelo Controlador, e clientes finais do Controlador (no caso dos dados retornados pelo ERP).

3.4. **Duração do tratamento**: pelo prazo de vigência do Contrato, mais 7 dias para soft delete e 30 dias para purga de backups.

### Cláusula 4ª — Obrigações do Operador

O Operador compromete-se a:

a) Tratar os dados pessoais **exclusivamente conforme as instruções documentadas** do Controlador, salvo obrigação legal;

b) Garantir que pessoas autorizadas a tratar os dados pessoais estejam sujeitas a obrigação de **confidencialidade**;

c) Implementar **medidas técnicas e organizacionais** apropriadas, incluindo:
   - Criptografia em trânsito (TLS 1.2+) e em repouso (AES-256-GCM em segredos);
   - Senha com argon2id (RFC 9106);
   - MFA TOTP opcional;
   - Multi-tenant com Row Level Security;
   - Auditoria com hash chain SHA-256;
   - SSRF protection no proxy;
   - Backup diário com criptografia at-rest;
   - Pipeline CI/CD com SAST, SCA, secret scan e SBOM CycloneDX;

d) **Notificar o Controlador em até 72 horas** após tomar conhecimento de incidente de segurança envolvendo os dados pessoais tratados;

e) Auxiliar o Controlador no atendimento aos pedidos de exercício de direitos dos titulares (LGPD Art. 18), por meio dos endpoints disponibilizados na plataforma (`/api/v1/lgpd/*`);

f) Disponibilizar ao Controlador as informações necessárias para demonstrar cumprimento das obrigações deste DPA;

g) Eliminar ou devolver os dados pessoais ao Controlador no encerramento do Contrato, em até 30 dias.

### Cláusula 5ª — Sub-operadores

5.1. O Controlador autoriza o uso dos sub-operadores listados em https://igagestao.com.br/legal/sub-processors, podendo ser atualizada com **30 dias de antecedência**.

5.2. O Operador celebra com cada sub-operador acordo escrito que imponha as mesmas obrigações deste DPA.

5.3. O Controlador pode opor-se à inclusão de novo sub-operador no prazo de 15 dias após notificação. Caso a objeção seja procedente, o Operador buscará alternativa ou poderá rescindir a parte afetada do Contrato.

### Cláusula 6ª — Transferência internacional

6.1. O tratamento pode envolver transferência internacional para EUA, Irlanda e regiões anycast globais (Cloudflare).

6.2. Toda transferência ocorre sob **cláusulas contratuais padrão** ou outra base legal admitida pela ANPD (LGPD Art. 33).

### Cláusula 7ª — Direitos dos titulares

7.1. O Controlador é responsável por atender aos pedidos dos titulares, podendo utilizar os endpoints de auto-serviço:
   - **Acesso/portabilidade**: `GET /api/v1/lgpd/my-data` e `GET /api/v1/lgpd/export`
   - **Correção**: tela de configurações
   - **Anonimização**: `POST /api/v1/lgpd/anonymize`
   - **Eliminação**: `POST /api/v1/lgpd/erase`

7.2. SLA do Operador para suporte ao Controlador em pedidos LGPD: **5 dias úteis**.

### Cláusula 8ª — Auditoria

8.1. O Operador disponibiliza ao Controlador, a cada 12 meses ou após incidente:
   - SBOM CycloneDX em https://igagestao.com.br/security/sbom.json
   - Resultado de scans de SAST/SCA mais recente
   - Resumo executivo de pentest (quando realizado)

8.2. Auditoria in loco mediante notificação prévia de 30 dias e custo a cargo do Controlador.

### Cláusula 9ª — Responsabilidade

9.1. Cada Parte responde pelos danos causados em decorrência de descumprimento das obrigações que lhe cabem nos termos da LGPD e deste DPA.

9.2. A responsabilidade do Operador limita-se ao valor pago pelo Controlador nos 12 meses anteriores ao evento, salvo dolo ou culpa grave.

### Cláusula 10ª — Vigência e rescisão

10.1. Este DPA vigora pelo prazo do Contrato.

10.2. Em caso de rescisão, o Operador eliminará os dados pessoais em até 30 dias, salvo obrigação legal de retenção.

### Cláusula 11ª — Foro

11.1. Foro da comarca de _[São Paulo, SP]_, com renúncia a qualquer outro.

---

**Local e data**: _____________________________

**[CLIENTE]**: _____________________________________
**[IGA Gestão]**: ___________________________________

**Testemunhas**:
1. _____________________________  CPF: ___________
2. _____________________________  CPF: ___________

---

> Este modelo segue boas práticas LGPD mas **não substitui revisão por advogado**. Adapte cláusulas conforme o cliente e setor (saúde/financeiro podem exigir cláusulas adicionais).

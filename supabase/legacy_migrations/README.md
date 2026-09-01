# Migrações Legadas (Superseded)

Este diretório contém os arquivos de migrações legadas do projeto REPARAÍ anteriores à consolidação da arquitetura do MVP.

## Contexto e Diretrizes

1. **Histórico Pré-Consolidação**:
   Estes arquivos pertencem ao ciclo de desenvolvimento anterior a 29 de agosto de 2026.
2. **Preservação para Auditoria**:
   Todos os 30 arquivos foram mantidos intactos, byte a byte, exclusivamente para fins de rastreabilidade forense, auditoria e histórico de evolução do schema.
3. **Não Executar Diretamente**:
   Estes scripts **não devem ser aplicados ou executados diretamente** em nenhum ambiente (local, preview, staging ou produção).
4. **Consolidação Canônica**:
   Todas as tabelas, colunas, tipos, constraints, índices, triggers, RPCs e policies ativas provenientes destes arquivos foram integralmente normalizadas, auditadas e consolidadas no arquivo oficial:
   `supabase/migrations/20260829000200_mvp_consolidated.sql`
5. **Incompatibilidade de Nomenclatura com o Supabase CLI**:
   Foram retirados da pasta ativa `supabase/migrations/` porque os prefixos de 8 dígitos (`YYYYMMDD_...`) conflitam com a ordenação cronológica estrita de 14 dígitos (`YYYYMMDDHHMMSS_...`) exigida pelo Supabase CLI moderno (`db push`).
6. **Política de Exclusão**:
   **Não apagar** este diretório nem os arquivos contidos nele sem aprovação explícita e auditoria histórica prévia.

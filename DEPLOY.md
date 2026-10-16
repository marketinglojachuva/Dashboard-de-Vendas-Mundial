# Publicar na Vercel com histórico no Supabase

## Arquitetura

- GitHub: código versionado.
- Vercel: aplicação web Vite, conectada ao domínio.
- Supabase: login, dados das importações no PostgreSQL e arquivos XLSX/XLS originais em Storage privado.

O dashboard é reconstruído a partir do histórico salvo. O histórico pertence ao usuário autenticado; duas contas diferentes não compartilham dados. Os filtros de datas e a aparência ficam no dispositivo. Compartilhamento entre funcionários/contas não está implementado.

## 1. Banco e arquivos

No projeto atual (`gtdlvdpuydqazcgpbaec`), esta etapa já foi concluída. Somente se configurar OUTRO projeto Supabase, execute `supabase/migrations/20261016_ml_history.sql` no SQL Editor. Isso cria `ml_imports`, habilita RLS por usuário e configura o bucket privado `ml-spreadsheets` com limite de 50 MiB por arquivo. Nenhuma policy de leitura pública é criada.

O banco guarda os dados necessários para analisar as vendas, sem nome/CPF/endereço do comprador. Já o arquivo original contém todos os dados da exportação e fica privado, acessível apenas à conta que o enviou.

## 2. Acesso

Crie a conta do operador em Authentication > Users (e-mail e senha) no Supabase. A aplicação tem login por senha e não oferece cadastro público. Desative novos cadastros nas configurações do provedor de e-mail se este for um painel de uso restrito. Não inclua senhas de usuários no código.

## 3. Vercel

Importe `marketinglojachuva/Dashboard-de-Vendas-Mundial` na Vercel, branch main e diretório raiz `./`. Selecione Vite, comando `npm run build`, saída `dist`. O package.json define Node 24.

A conexão do projeto atual já está incluída em `.env.production` com apenas URL e chave pública. Basta importar e fazer Deploy. Não é necessário cadastrar variáveis. Remova valores VITE_SUPABASE_* antigos ou incorretos da Vercel, se houver: eles têm prioridade sobre o arquivo.

Somente para conectar OUTRO projeto, substitua os valores em Settings > Environment Variables:

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUA_CHAVE_PUBLICA
```

Use a chave publicável; nunca uma secret key ou service_role no frontend. A proteção dos dados depende das policies RLS e do login. Faça novo deploy depois de alterar as variáveis: Vite as inclui no build.

O arquivo `vercel.json` já contém os parâmetros básicos. Conecte o domínio na Vercel. O site não precisa ser hospedado no Supabase.

## 4. Levar o histórico atual

Antes de trocar da prévia para o novo domínio, abra “Meus arquivos” no endereço antigo e exporte o backup JSON. O navegador não compartilha IndexedDB entre domínios.

No endereço novo, entre na conta e restaure o backup JSON. Na tela vazia há “restaurar um backup”; com dados, use Meus arquivos > Restaurar backup. Registros com nome ou ID já existentes são mantidos, sem sobrescrever a versão da nuvem.

Se o histórico local estiver no MESMO endereço que passou a usar Supabase, use “Transferir histórico deste navegador”. A transferência preserva os dados locais e é reexecutável; itens já presentes são ignorados. Os XLSX originais não fazem parte do antigo backup JSON: reimporte-os para arquivar os arquivos completos na nuvem. Arquivos de versões antigas do parser precisam de reimportação para passar pela nova validação.

## 5. Teste final em conta real

A integração foi implementada, mas somente deve ser considerada ativa depois destes testes no seu projeto:

1. Entrar na conta A, importar um XLSX e confirmar que o histórico aparece.
2. Abrir outro dispositivo/navegador, entrar na mesma conta A e conferir os mesmos registros e totais.
3. Baixar o XLSX original e comparar o arquivo com o enviado.
4. Entrar na conta B: ela não deve listar, editar, excluir ou baixar os dados da conta A. Testar também as chamadas diretas com o token da conta B.
5. Abrir o site sem login: o histórico deve estar inacessível.
6. Alterar o mesmo registro em duas sessões: a segunda gravação desatualizada deve ser recusada, pedindo atualização.
7. Desconectar a rede ao salvar: não deve aparecer uma confirmação falsa de sucesso.

Sem as duas variáveis, o painel continua em modo local e informa isso no topo. Uma configuração parcialmente preenchida gera erro explícito. O modo nuvem não recorre ao armazenamento local silenciosamente quando há falha de rede.

## Operação

Atualizar ou voltar o foco à aba recarrega o histórico da nuvem. Reimportar o mesmo nome atualiza aquele registro. Arquivos com nomes diferentes continuam no histórico; vendas repetidas são conciliadas pela exportação mais recente.

Uma gravação atualiza o banco somente após o upload do original. Em falha no banco, o novo arquivo é removido em uma tentativa de limpeza. Falhas de rede durante limpeza podem deixar objetos sem referência no bucket; a atualização do histórico não depende deles. Não há promessa de transação única entre PostgreSQL e Storage.

A cópia original antiga é removida depois de a nova versão ser confirmada. Não há histórico imutável de todas as versões do mesmo arquivo. Exporte backups conforme a sua rotina; planos, retenção e backups da infraestrutura devem ser verificados na sua conta Supabase.

Referências: https://vercel.com/docs/frameworks/frontend/vite · https://supabase.com/docs/guides/database/postgres/row-level-security · https://supabase.com/docs/guides/getting-started/api-keys


## Conexão preparada em 16/10/2026

Projeto: `gtdlvdpuydqazcgpbaec` (`supabase-cinnabar-pendant`). A migração `ml_history` foi aplicada: tabela com RLS, permissões por usuário e bucket privado de 50 MiB. O advisor de segurança não apontou problemas. Ainda é necessário criar o primeiro usuário em Authentication → Users → Add user → Create new user e validar login, upload, recarga e download na prévia. Não compartilhe senhas em mensagens.

A prévia foi compilada com a URL e chave publicável do projeto. O repositório inclui esses mesmos valores públicos em `.env.production`, carregado automaticamente durante o build da Vercel. Credenciais de serviço nunca devem ser colocadas no frontend.

# Central de Vendas — Mercado Livre

Dashboard React, TypeScript, Tailwind e Recharts para relatórios XLSX da Central de Vendas. Sem configuração de nuvem, os dados ficam no navegador (IndexedDB). Com Supabase configurado, o painel usa login, PostgreSQL por usuário e Storage privado para os arquivos originais. Consulte `DEPLOY.md` para configurar GitHub + Vercel + Supabase.

## Executar

```sh
npm ci
npm run dev
npm run build
npm test
```

O build estático fica em `dist/`. O teste opcional do relatório real recebe um caminho externo, sem incluir dados do comprador no repositório:

```sh
ML_FIXTURE=/caminho/relatorio.xlsx npm test
```

## Comparação por datas

- Todas as importações formam um histórico único. A chave de conciliação é o ID de venda + ID do anúncio; SKU/preço/status podem mudar entre exportações sem duplicar a venda. A exportação mais recente prevalece; empates usam a data de importação.
- Filtros de 7, 15 e 30 dias ou início/fim personalizados. O intervalo anterior tem exatamente a mesma duração. É possível escolher outro fim de comparação, sem sobreposição.
- São comparadas quantidades e receitas reais. Não há projeção de 7 para 30 dias nem normalização por média diária.
- O dia da exportação é excluído das janelas completas. O último período padrão termina no dia completo mais recente disponível.
- A cobertura vem dos limites informados na importação. O arquivo não informa explicitamente o intervalo solicitado; por isso a primeira e última venda são uma estimativa inicial. Confirme as datas originais de exportação no histórico, especialmente quando houver dias sem vendas nas bordas.
- Dias sem cobertura bloqueiam os resultados daquele intervalo. Dias sem vendas dentro da cobertura são zero. Não se compara um intervalo incompleto como se fosse completo.
- A tabela agrupa variações do mesmo MLB, mostra seus SKUs, unidades anteriores/atuais, diferença absoluta e percentual. Anúncios com base anterior zero não recebem percentual inventado.

## Análises

Regiões, UFs, atribuição de publicidade, modalidade de entrega, Clássico/Premium, tarifas, saldo de envio, líquido do relatório, cancelamentos/devoluções e reclamações abertas. Gráficos alternam entre faturamento e unidades.

A coluna em branco de publicidade significa ausência de atribuição; não comprova origem orgânica. A planilha não contém investimento em Ads, custo de aquisição de produtos ou inventário disponível: ROAS, ACOS, lucro real e estoque não são calculados. Recomendações de estoque são sugestões de conferência. O líquido do relatório não comprova saldo disponível em conta.

Status de devolução, devolvido e reembolso são tratados no parser. Devoluções em andamento também são excluídas dos resultados comerciais. Em pacotes, os valores financeiros são rateados e o residual de arredondamento vai ao último item, preservando cada total do pacote. As quantidades de pedidos são IDs de venda distintos, não compradores distintos.

Dados pessoais do comprador não são incluídos nos registros analisados. Os XLSX originais ficam no Storage privado e podem conter esses dados. UF é retida para análise geográfica. A foto só aparece quando há uma coluna HTTPS `URL da imagem`; o relatório padrão não contém fotos. “Ver concorrentes” abre uma busca por título no Mercado Livre.

## Atualização de arquivos antigos

Reimporte os XLSX anteriores para aplicar o parser v3 (validação estrita de datas, colunas e valores). Vendas duplicadas entre relatórios serão conciliadas. Se o relatório atual contiver todo o histórico anterior, basta reimportá-lo. Os filtros persistem ao importar fontes adicionais.

## Validação

Testes cobrem equivalência de intervalos, diferenças reais de unidades, histórico ausente, dias parciais, sobreposição de relatórios, precedência por exportação, produto que parou de vender, base zero e ticket por ID. O teste opcional do XLSX real concilia as somas integrais de bruto, tarifas, líquido e reembolsos com as colunas originais, além dos filtros 7/15/30.

O build TypeScript/Vite foi validado. O bundle ainda gera aviso de tamanho acima de 500 kB. Testes visuais em navegador não foram realizados neste ambiente.

## Revisão de clareza e integridade — parser v3

A tela Resumo apresenta uma conclusão em linguagem simples, quatro indicadores e os produtos que merecem atenção. A tabela completa fica em Produtos; as datas personalizadas e as regras de cálculo ficam recolhidas. Em Detalhes das vendas, é possível exportar a conferência por registro com o nome do arquivo de origem.

A importação v3 procura a aba de vendas mesmo quando há uma capa. Colunas extras e ordem diferente são aceitas quando os nomes/grupos esperados estão presentes. Colunas essenciais ausentes, datas inválidas, quantidades inválidas, IDs inseguros ou repetidos, números malformados, novos status não reconhecidos e pacotes incompletos interrompem a importação; nenhuma linha é silenciosamente descartada. Os totais de bruto, tarifas, líquido e reembolsos são conciliados em centavos com as colunas originais antes de salvar.

Arquivos lidos por versões anteriores precisam ser reimportados e não entram na análise até então. Reimportar o mesmo nome de arquivo atualiza o registro existente. As validações e o histórico de versões não permitem garantir toda alteração futura do formato do Mercado Livre: estruturas novas ou ambíguas devem ser revisadas, sem produzir números por suposição.

Foram executados 16 testes automatizados, incluindo conferência independente das unidades de cada anúncio com as linhas originais nos dois intervalos de 7, 15 e 30 dias. Os testes de compatibilidade e rejeição incluem planilhas sintéticas. O arquivo real e os dados de compradores não são incluídos no código publicado.


## Tema e histórico na nuvem

Há seletor de tema claro, escuro e automático, com preferência local. A navegação, os cards e os gráficos usam a mesma paleta semântica nos dois temas.

A integração Supabase contém controle de acesso por usuário, paginação do histórico, gravação com revisão para recusar alterações concorrentes, armazenamento privado de originais e transferência do histórico local. A mudança de domínio exige exportar/restaurar backup: o IndexedDB do endereço anterior não é acessível pelo novo endereço.

Validação: 21 testes locais aprovados (16 de análise/importação e 5 do adaptador de nuvem com cliente simulado), além do build. Os testes de login, políticas RLS, Storage e dois dispositivos precisam ser executados no projeto Supabase real; ainda não foram executados. O SQL de configuração está em `supabase/migrations/20261016_ml_history.sql`. As credenciais publicáveis são configuradas por variáveis de ambiente e não há chave secreta no código.


## Importação direta na Vercel

Este repositório já inclui a conexão pública do Supabase em `.env.production`. Importe a branch main na Vercel com framework Vite, raiz ./ e Node 24. Não é necessário copiar chaves. Consulte DEPLOY.md para criar seu login e testar.

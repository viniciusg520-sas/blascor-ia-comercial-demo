# Blascor IA Comercial 2.0

Sistema local de discadora assistida para o comercial da Blascor Tintas. A versão 2.0 roda direto no navegador, sem backend, usando `localStorage`.

## Como abrir

1. Abra a pasta `blascor-ia-comercial`.
2. Dê duplo clique em `index.html`.
3. Use Chrome, Edge ou Firefox atualizado.

Não há instalação de dependências, servidor ou banco de dados.

## Principais recursos da versão 2.0

- Cadastro de leads com representante, prioridade, última compra, valor da última compra e observações internas.
- Histórico completo de contatos por lead.
- Agendamento de retorno com data e hora.
- Indicador visual para retornos vencidos.
- Tela `Próximo Lead` com fila inteligente e botão `Ligar próximo`.
- Dashboard com gráficos em canvas.
- Cadastro de vendedores e vendedor ativo.
- Relatório de produtividade por vendedor.
- Importação em lote com validação de campos obrigatórios e duplicidade de telefone.
- Exportação CSV e exportação Excel `.xls` com leads, produtividade e histórico.
- Código preparado para migração futura para Electron e integração com Protheus.

## Como cadastrar leads

Na aba `Operação`, preencha o formulário lateral e clique em `Salvar lead`.

Campos mínimos: empresa, cidade, estado e telefone. Os demais campos ajudam no controle comercial:

- Representante responsável
- Prioridade: Alta, Média ou Baixa
- Última compra
- Valor da última compra
- Retorno agendado
- Observações internas

## Como registrar contatos e histórico

Na tabela de leads, clique em `Contato`.

Você pode informar:

- Tipo do contato: ligação, WhatsApp, e-mail ou visita
- Resultado
- Resumo do contato
- Vendedor
- Data e hora de retorno

Ao salvar, o contato entra no histórico do lead. O texto do resumo também alimenta a classificação automática.

## Classificação automática

Ao salvar um contato, o sistema classifica:

- `Quente`: interesse, catálogo, comprador, pedido, orçamento, WhatsApp ou reunião.
- `Morno`: retornar, analisar, depois, semana que vem ou ligar outro dia.
- `Frio`: não tem interesse, não trabalha, já tem fornecedor ou não quer.
- `Convertido`: quando o resultado do contato for `Conversão`.
- `Pendente`: quando nenhuma palavra-chave for identificada.

## Agendamento de retorno

Use o campo `Retorno agendado` no cadastro ou no modal de contato.

Retornos com data/hora anterior ao momento atual aparecem com destaque visual e entram no card `Retornos vencidos`.

## Discagem com MicroSIP

O botão `Ligar` e o botão `Ligar próximo` limpam o telefone, mantendo apenas números, e chamam o protocolo `tel:`.

```js
window.location.href = `tel:${numeroLimpo}`;
```

Para funcionar com MicroSIP, configure o Windows para abrir links `tel:` com o MicroSIP:

1. Abra `Configurações` do Windows.
2. Vá em `Aplicativos` > `Aplicativos padrão`.
3. Escolha padrões por protocolo ou tipo de link.
4. Associe `TEL`/`tel:` ao MicroSIP.

## Exportação e importação

- `Exportar CSV`: gera um CSV completo dos leads.
- `Exportar Excel`: gera um arquivo `.xls` com abas/seções de leads, produtividade e histórico.
- `Importar lote`: aceita CSV com vírgula ou ponto e vírgula.

Campos aceitos na importação:

```txt
Empresa, Cidade, Estado, Telefone, WhatsApp, Comprador, Representante, Prioridade, Status, Retorno, Última compra, Valor última compra, Observações, Observações internas
```

Antes de importar, o sistema mostra uma validação com linhas válidas e linhas com erro.

## Vendedores e produtividade

Na aba `Vendedores`, cadastre representantes/vendedores. O seletor no topo define o vendedor ativo para novos contatos e leads.

Na aba `Relatórios`, veja:

- Leads por vendedor
- Ligações registradas
- Conversões
- Retornos pendentes
- Retornos vencidos
- Taxa de conversão

## Preparação para Protheus e Electron

O código concentra pontos de integração em serviços/adaptadores:

- `window.BlascorApp.services.storage`
- `window.BlascorApp.services.dialer`
- `window.BlascorApp.adapters.protheus`

Para uma versão Electron, a camada `dialer` pode trocar `tel:` por IPC/Node chamando:

```txt
"C:\Program Files\MicroSIP\microsip.exe" NUMERO
```

Para Protheus, o adaptador já monta payloads de lead e histórico que podem ser enviados para uma API REST, rotina customizada ou middleware.

## Limitações da versão local

- Dados ficam apenas no navegador usado.
- Limpar dados do navegador pode apagar a base.
- Não há autenticação real, apenas controle local de vendedores.
- Não há sincronização entre computadores.
- Navegadores não executam `.exe` ou `.bat` diretamente por segurança.
- A exportação Excel é compatível com Excel via arquivo `.xls` HTML, não é uma planilha `.xlsx` nativa.

## Próximos passos recomendados

- Empacotar com Electron ou Tauri.
- Trocar `localStorage` por SQLite local ou backend.
- Adicionar login real e auditoria.
- Integrar com Protheus via API/middleware.
- Criar sincronização multiusuário.
- Melhorar regras de deduplicação por CNPJ, telefone e cidade.

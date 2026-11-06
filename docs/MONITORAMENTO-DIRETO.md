# Monitoramento direto no navegador — versão 0.2.0

Não é necessário contratar servidor, executar um processo local separado ou manter cada conversa aberta. O cliente Telegram fica na aba **Canais conectados** da própria extensão. É necessário manter essa aba aberta, o navegador em execução, o computador ligado e a internet conectada.

## Primeira conexão

1. Na página de extensões do Chrome ou Edge, recarregue o Radar e confira **0.2.0**.
2. Abra o painel do Radar e clique em **Abrir monitoramento direto**.
3. Entre em [my.telegram.org/apps](https://my.telegram.org/apps), com sua própria conta, e obtenha seu **API ID** e **API Hash**. Esses dados identificam seu aplicativo cliente; não são um token de bot.
4. Digite esses dados e o telefone com país e DDD na aba do Radar.
5. Se quiser guardar a sessão, marque a opção e escolha uma senha local com pelo menos 10 caracteres.
6. Clique em conectar. Digite no formulário do Radar o código recebido pelo Telegram ou SMS. Se houver verificação de duas etapas, informe a senha no formulário seguinte. Nunca envie esses dados em chats.
7. Cadastre o produto e marque os canais da lista.
8. Clique em **Buscar nas últimas 100 mensagens por canal**. Essa busca funciona sem abrir as conversas.
9. Para novas mensagens, basta manter a aba conectada. Ao criar um novo produto, clique em buscar para verificar as mensagens anteriores.

A lista considera até 500 conversas da conta e mostra somente canais e grupos. É possível selecionar até 100. O filtro de nomes ajuda a encontrar os desejados. A busca anterior analisa até 100 mensagens de cada canal selecionado; não é uma busca completa de todo o histórico.

## Sessão e privacidade

O cliente fala diretamente com o Telegram por WebSocket. Não existe um servidor do Radar recebendo suas credenciais ou mensagens.

Sem guardar sessão, ela fica apenas na memória da aba. Com a opção marcada, API ID, API Hash, telefone e sessão são criptografados com AES-256-GCM e uma chave derivada da senha local usando PBKDF2-SHA256 (310.000 iterações). A senha local, código de login e senha de duas etapas não são salvos. Ao reabrir, desbloqueie a sessão com sua senha local. Não existe recuperação dessa senha: esqueça a sessão e faça novo login se a perder.

A sessão desbloqueada existe na memória enquanto conectado. O histórico de correspondências e os nomes dos canais ficam no armazenamento local da extensão, sem criptografia adicional. Use um perfil pessoal de navegador e não compartilhe sessões ou arquivos de perfil. A API autoriza uma sessão da sua conta, embora o código do Radar só leia conversas e mensagens.

**Desconectar** encerra a conexão e remove o cofre salvo neste navegador. Para revogar também a autorização no Telegram, vá em **Configurações → Dispositivos** no aplicativo oficial. **Esquecer sessão local** remove o cofre e permite fazer novo login; também não revoga a autorização remota.

Ao conectar uma conta diferente, o Radar limpa as seleções e o histórico local para não misturar dados. As palavras dos produtos são preservadas. Apenas uma aba de monitoramento direto pode estar conectada por vez.

## Limitações e recuperação

- Fechar a aba do Radar, suspender o computador ou descartar a aba interrompe a conexão. Não há garantia de alertas em tempo real em abas suspensas.
- Ao reconectar, use a busca recente para conferir mensagens potencialmente perdidas. A janela é de até 100 mensagens por canal.
- Pausar interrompe o registro de correspondências; retomar não pesquisa automaticamente mensagens passadas.
- Erros de limite do Telegram interrompem a busca. Aguarde o prazo solicitado antes de tentar de novo.
- Conteúdo apenas em imagem/vídeo não é analisado. Não há validação de desconto, estoque ou segurança de links.
- Em canais e supergrupos, o botão Abrir mensagem posiciona na postagem original pelo ID. Resultados antigos ganham o link ao serem encontrados novamente na busca, sem repetir a notificação. Grupos básicos e resultados sem ID continuam abrindo apenas a conversa. A conta conectada ao Telegram Web precisa ter acesso ao canal; mensagens removidas podem não abrir.
- O login deve usar uma conta existente. Desafios adicionais não suportados podem exigir retomar pelo aplicativo oficial.
- O modo anterior, que lê a conversa aberta no Telegram Web, continua no painel antigo.

## Desenvolvimento e validação

```sh
npm ci
npm run build
npm test
npm run check
npm run smoke
```

O bundle de cliente está incluído em extension/vendor; nenhuma biblioteca é baixada ao usar o Radar. As dependências e respectivas versões ficam no package-lock.json. Os avisos de licença do bundle acompanham o arquivo gerado.

Os testes cobrem criptografia, validação de origem/conta/canal, deduplicação, pausa, busca recente e identificação de mensagens. O smoke test inicializa o bundle com geração de código e WASM desativados. Login real e recebimento de eventos ainda dependem de validação com uma conta autorizada.

## Referências

- [Credenciais da API do Telegram](https://core.telegram.org/api/obtaining_api_id)
- [Autorização de usuários](https://core.telegram.org/api/auth)
- [Teleproto](https://docs.teleproto.dev)
- [Compatibilidade e migração](https://docs.teleproto.dev/migrating-from-gramjs)

## Atualização 0.2.2

Após recarregar a extensão e reabrir a aba do Radar, desbloqueie a sessão e clique em buscar novamente. As correspondências antigas encontradas nessa janela ganham o botão Abrir mensagem. A atualização não altera a sessão criptografada.

## Atualização 0.2.3 — horários

Os resultados do modo direto mostram a data original de publicação e, quando informada pelo Telegram, a data da última edição, no fuso de Brasília. Resultados sem data original são identificados como Encontrado em. Execute uma nova busca para atualizar as datas das correspondências antigas ainda presentes na janela de 100 mensagens; essa atualização não repete notificações. A hora da última leitura continua representando a leitura do Radar.

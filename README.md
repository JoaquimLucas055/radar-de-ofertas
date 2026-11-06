# Radar de Ofertas — 0.2.0

Agora há um modo de conexão direta: procure produtos nos canais escolhidos sem abrir cada conversa, mantendo apenas a aba do Radar aberta. Sem servidor de hospedagem.

**Comece pelo [guia do monitoramento direto](docs/MONITORAMENTO-DIRETO.md).** Recarregue a extensão para a versão 0.2.0 e clique em **Abrir monitoramento direto** no painel. O primeiro login requer suas credenciais API ID/API Hash e a confirmação da sua conta no formulário local.

O código foi verificado com testes automatizados e inicialização do bundle. A autenticação e o recebimento real de mensagens precisam ser validados com sua conta; não foram executados automaticamente.

## Modo anterior: conversa aberta no Telegram Web

Extensão Manifest V3 para Chrome e Edge. Cadastre produtos e receba notificações quando as palavras aparecerem nas mensagens de texto carregadas das conversas que você escolher no Telegram Web.

**Estado: MVP experimental.** Telegram Web A e K têm seletores previstos; a integração com uma sessão real ainda precisa de validação manual. WhatsApp não está implementado.

## Instalar

1. Baixe e extraia o projeto (se estiver usando o ZIP, extraia antes).
2. Abra a página de extensões do Chrome (`chrome://extensions`) ou Edge (`edge://extensions`).
3. Ative **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação** e escolha a pasta **extension** deste projeto.
5. Clique no ícone da extensão para abrir o painel.
6. Cadastre um produto, por exemplo `Nintendo Switch`, com exclusões opcionais como `capa, película, usado`.
7. Abra [Telegram Web K](https://web.telegram.org/k/) ou [Telegram Web A](https://web.telegram.org/a/). Se a página já estava aberta, recarregue.
8. Entre no canal ou conversa desejado e clique no botão verde **Radar · Monitorar esta conversa**.
9. Mantenha essa conversa aberta em uma aba. Para várias conversas simultâneas, use uma aba para cada uma.

Não é preciso Node.js para instalar a extensão. Não é necessário token do Telegram, bot ou servidor.

## O que funciona nesta versão

- Até 50 produtos, cada um com todas as palavras obrigatórias, sem distinguir acentos e maiúsculas.
- Exclusões por palavra ou expressão, separadas por vírgula.
- Escolha explícita de até 100 conversas; pausa global e por produto.
- Notificações do navegador e indicador no ícone.
- Até 200 correspondências no histórico, busca textual e link para abrir a conversa.
- Deduplicação local das últimas 5.000 combinações de conversa, texto e regra.
- Nenhum envio de mensagens, compra automática ou análise fora do Telegram Web.

Exemplo: `fone bluetooth` corresponde a “Fone sem fio BLUETOOTH em promoção”, mas não a “microfone bluetooth”. As palavras podem aparecer em qualquer ordem. O produto “PS5” não corresponde automaticamente a “PlayStation 5”: cadastre outro alerta para sinônimos.

## Limites importantes

A extensão **não monitora todos os canais seguidos automaticamente**, não busca todo o histórico e não funciona com o navegador fechado. A página pode descarregar mensagens ao trocar de conversa ou suspender uma aba; só o texto presente na página é analisado, até 100 corpos de mensagem por leitura. A primeira leitura pode gerar alertas de mensagens antigas. Abas em segundo plano podem sofrer atrasos.

Uma correspondência significa apenas que o texto contém as palavras cadastradas. Não há verificação de desconto, estoque, preço, reputação da loja ou validade da promoção. Conteúdo somente em imagem/vídeo não é lido. O link do histórico abre a conversa, não necessariamente a mensagem exata.

Os títulos e as mensagens dependem do HTML do Telegram Web. Mudanças no Telegram podem exigir ajustes em `extension/content.js`. Conversas cadastradas no Web K e A são identificadas separadamente. O histórico pode armazenar mensagens da conta anterior se você trocar de conta no Telegram; remova conversas e dados da extensão antes de trocar de conta em um navegador compartilhado.

## Monitoramento sem abrir conversas

O modo direto está implementado na versão 0.2.0 e funciona em uma aba própria. Consulte o [guia de conexão](docs/MONITORAMENTO-DIRETO.md). Ele não requer servidor, mas exige login próprio, API ID/API Hash e a aba do Radar aberta.

## Privacidade do modo anterior

Tudo fica em `chrome.storage.local` neste perfil do navegador: regras, conversas escolhidas, correspondências e hashes de deduplicação. O acesso a esse armazenamento é limitado aos contextos confiáveis da extensão. O código não faz requisições de rede nem usa analytics. A única permissão de site é `https://web.telegram.org/*`. Notificações podem exibir o produto e o nome da conversa na tela; o corpo da mensagem permanece no histórico.

A extensão inspeciona o texto das conversas escolhidas. Use apenas em um perfil seu. Remover uma conversa interrompe novas leituras dela; seu histórico já salvo permanece até ser limpo. Limpar o histórico preserva os hashes para evitar alertas repetidos. Desinstalar a extensão remove os dados locais.

## Desenvolvimento

Requer Node.js 20 ou superior. Para compilar o cliente integrado, execute npm ci e npm run build.

```sh
npm test
npm run check
```

Os testes cobrem correspondência, exclusões, validação de URLs, deduplicação, autorização do worker, pausa, concorrência entre abas e falha de notificação. A checagem verifica sintaxe, recursos referenciados e manifest.

Veja [o roteiro manual](docs/VALIDACAO.md) antes de considerar a integração validada em uma conta real.

## Estrutura

- `extension/`: pasta instalável, painel, leitor de mensagens e service worker.
- `extension/lib/matcher.js`: busca, validação e hash de deduplicação.
- `tests/`: testes sem dependências.
- `scripts/check.mjs`: verificação de sintaxe e recursos.
- `.github/workflows/ci.yml`: verificações no GitHub.

## Publicar o repositório no GitHub

Este projeto é um repositório Git local. Criar um remoto exige autenticação e acesso à sua conta. Depois de criar um repositório vazio chamado `radar-ofertas`, execute nesta pasta, substituindo SEU_USUARIO:

```sh
git remote add origin https://github.com/SEU_USUARIO/radar-ofertas.git
git push -u origin main
```

O ZIP não inclui a pasta `.git`. Se você trabalhar a partir dele, execute `git init -b main`, `git add .` e `git commit -m "Versão inicial do Radar de Ofertas"` antes de publicar.

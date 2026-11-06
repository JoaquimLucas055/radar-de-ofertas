# Validação em uma sessão real

Ainda não executada neste ambiente. Use uma conversa de teste sem dados sensíveis e uma segunda conta autorizada para enviar mensagens.

1. Carregue a pasta extension no Chrome ou Edge e confira se não há erros na página de extensões.
2. No painel, crie o alerta "fone bluetooth" com exclusões "usado, sem garantia".
3. No Telegram Web K, abra a conversa de teste e ative o botão Radar.
4. Envie de outra conta "Fone bluetooth em promoção". Espere até 15 segundos na aba ativa. Deve aparecer uma correspondência, notificação (se autorizada no sistema) e indicador no ícone.
5. Envie "microfone bluetooth" e "fone bluetooth usado". Não devem gerar correspondências.
6. Recarregue a página. O mesmo texto não deve notificar novamente.
7. Envie uma mensagem diferente: "Fone bluetooth por R$ 89". Deve gerar nova correspondência.
8. Abra outra conversa não cadastrada e envie texto correspondente. Não deve gerar alerta. Confira também a troca rápida entre conversas.
9. Pause o Radar, envie outra mensagem correspondente e confirme que ela não foi salva. Ao retomar, mensagens ainda carregadas podem gerar alerta.
10. Mantenha duas abas com conversas cadastradas e envie mensagens diferentes; ambas devem ser preservadas no histórico.
11. Remova a conversa e confirme que não há novas leituras.
12. Repita no Telegram Web A. Se não houver leituras, confira os seletores de corpo e título em content.js.
13. Confira busca no histórico, exclusão de regra e limpeza do histórico.
14. Bloqueie notificações no sistema e confirme que o histórico continua funcionando.
15. Confira que o link do histórico abre a conversa e que mensagens com HTML são exibidas como texto.

Limitações esperadas: abas suspensas, mensagens não carregadas, imagens e navegador fechado não produzem alertas. Repetir exatamente o mesmo texto e regra na mesma conversa não gera novo alerta enquanto a chave estiver na janela de deduplicação.

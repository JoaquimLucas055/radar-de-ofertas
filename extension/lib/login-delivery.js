export function codeDelivery(isApp, details = {}) {
  const type = details.type || (isApp ? 'app' : '');
  const labels = {
    app: 'Código enviado para o aplicativo Telegram. Abra a conversa de serviço “Telegram” em uma sessão já conectada.',
    sms: 'O Telegram informou envio por SMS. Confira o aplicativo de mensagens do telefone.',
    smsWord: 'O Telegram informou envio de uma palavra por SMS. Digite a palavra recebida.',
    smsPhrase: 'O Telegram informou envio de uma frase por SMS. Digite a frase recebida.',
    call: 'O Telegram informou uma ligação com o código. Confira as chamadas do telefone.',
    flashCall: 'O Telegram informou uma chamada rápida. O número que ligou é usado como código.',
    missedCall: 'O Telegram informou uma chamada perdida. Use os últimos dígitos do número que ligou.',
    fragment: 'O Telegram indicou entrega via Fragment. Confira as instruções da sua conta para esse número.'
  };
  return labels[type] || 'O Telegram solicitou um código de login. Confira o aplicativo Telegram e os métodos de entrega disponíveis na sua conta.';
}

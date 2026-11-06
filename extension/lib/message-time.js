const maxDate = 8640000000000000;
export function validTimestamp(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= maxDate ? value : null;
}
export function fromTelegramTime(seconds) {
  return typeof seconds === 'number' ? validTimestamp(seconds * 1000) : null;
}
export function messageTimes(input) {
  const postedAt = validTimestamp(input.postedAt);
  const editedAt = validTimestamp(input.editedAt);
  return { ...(postedAt ? { postedAt } : {}), ...(editedAt && (!postedAt || editedAt >= postedAt) ? { editedAt } : {}) };
}
const formatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false
});
export function historyTime(item) {
  const times = messageTimes(item);
  const posted = times.postedAt ? 'Publicado em ' + formatter.format(times.postedAt) :
    validTimestamp(item.at) ? 'Encontrado em ' + formatter.format(item.at) : 'Data da postagem indisponível';
  return posted + (times.editedAt ? ' · Editado em ' + formatter.format(times.editedAt) : '') + ' · horário de Brasília';
}

// Визначає склад ролей залежно від кількості гравців.
// Проста, збалансована формула для класичної "Мафії".
// Дон мафії з'являється тільки коли в мафії 2+ гравці (тоді один з них стає доном).
export function buildRoleDeck(playerCount) {
  if (playerCount < 4) {
    throw new Error("Потрібно щонайменше 4 гравці");
  }

  const mafiaCount = Math.max(1, Math.floor(playerCount / 4));
  const hasDon = mafiaCount >= 2;
  const hasDoctor = playerCount >= 5;
  const hasSheriff = playerCount >= 6;

  const deck = [];
  let regularMafiaCount = mafiaCount;
  if (hasDon) {
    deck.push("don");
    regularMafiaCount -= 1;
  }
  for (let i = 0; i < regularMafiaCount; i++) deck.push("mafia");
  if (hasDoctor) deck.push("doctor");
  if (hasSheriff) deck.push("sheriff");

  while (deck.length < playerCount) {
    deck.push("citizen");
  }

  return shuffle(deck);
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const MAFIA_TEAM_ROLES = ["mafia", "don"];

export const ROLE_INFO = {
  host: {
    label: "Ведучий",
    team: "host",
    description: "Керує грою: бачить усі ролі, може позначити гравця вбитим/вигнаним."
  },
  mafia: {
    label: "Мафія",
    team: "mafia",
    description: "Вночі обирайте жертву разом з іншими мафіозі та доном."
  },
  don: {
    label: "Дон мафії",
    team: "mafia",
    description: "Керує мафією: разом з нею обирає жертву, а також вночі перевіряє, чи гравець — шериф."
  },
  doctor: {
    label: "Лікар",
    team: "citizens",
    description: "Вночі можете врятувати одного гравця (себе — раз за гру)."
  },
  sheriff: {
    label: "Шериф",
    team: "citizens",
    description: "Вночі перевіряєте одного гравця — мафія він чи ні."
  },
  citizen: {
    label: "Мирний житель",
    team: "citizens",
    description: "Вдень шукайте мафію та голосуйте за вигнання підозрюваних."
  }
};

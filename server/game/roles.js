//roles.js

// Визначає склад ролей залежно від кількості гравців.
export function buildRoleDeck(playerCount) {
  if (playerCount < 5) {
    throw new Error("Потрібно щонайменше 5 гравців для початку гри");
  }

  // Якщо гравців 7 або більше — 2 мафіозі (Дон + Мафія), Шериф, Лікар, решта — Мирні
  if (playerCount >= 7) {
    const deck = ["don", "mafia", "sheriff", "doctor"];

    while (deck.length < playerCount) {
      deck.push("citizen");
    }

    return shuffle(deck);
  }

  // Для малих компаній (5–6 гравців) замість звичайної мафії видаємо Дона
  const hasDoctor = playerCount >= 5;
  const hasSheriff = playerCount >= 6;

  const deck = ["don"]; // Дон замість звичайної мафії
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
// roles.js
export const MAFIA_TEAM_ROLES = ["mafia", "don"];

export const ROLE_INFO = {
  host: {
    label: "Ведучий",
    team: "host",
    description: "Ви керуєте грою, фазами дня та ночі, бачите всі ролі та нічні дії."
  },
  don: {
    label: "Дон мафії",
    team: "mafia",
    description: "Голова мафії. Вночі разом із мафією обирає жертву та окремо перевіряє, чи є гравець шерифом."
  },
  mafia: {
    label: "Мафія",
    team: "mafia",
    description: "Знає інших мафіозі. Вночі обирає жертву, вдень прикидається мирним жителем."
  },
  maniac: {
    label: "Маніяк",
    team: "maniac",
    description: "Одинак. Перемагає, якщо залишиться сам на сам. Вночі вбиває будь-кого на власний розсуд."
  },
  beauty: {
    label: "Красуня",
    team: "citizens",
    description: "Грає за мирних. Вночі відволікає обраного гравця — його нічна дія блокується."
  },
  immortal: {
    label: "Безсмертний",
    team: "citizens",
    description: "Мирний житель, якого неможливо вбити вночі (вибуває лише на денному голосуванні)."
  },
  sheriff: {
    label: "Шериф",
    team: "citizens",
    description: "Грає за мирних. Щоночі перевіряє одного гравця і дізнається, чи належить він до мафії."
  },
  doctor: {
    label: "Лікар",
    team: "citizens",
    description: "Грає за мирних. Щоночі обирає одного гравця (можна себе), якого рятує від нападу."
  },
  citizen: {
    label: "Мирний житель",
    team: "citizens",
    description: "Не має нічних дій. Вдень аналізує поведінку гравців і голосує за вигнання підозрюваних."
  }
};

export function getDefaultDeckConfig(playerCount) {
  if (playerCount <= 1) {
    return { don: 1, mafia: 0, sheriff: 0, doctor: 0, maniac: 0, beauty: 0, immortal: 0 };
  }
  if (playerCount === 2) {
    return { don: 1, mafia: 0, sheriff: 0, doctor: 0, maniac: 0, beauty: 0, immortal: 0 };
  }
  if (playerCount === 3) {
    return { don: 1, mafia: 0, sheriff: 0, doctor: 1, maniac: 0, beauty: 0, immortal: 0 };
  }
  if (playerCount <= 6) {
    return { don: 1, mafia: 0, sheriff: 1, doctor: 1, maniac: 0, beauty: 0, immortal: 0 };
  }
  if (playerCount <= 8) {
    return { don: 1, mafia: 1, sheriff: 1, doctor: 1, maniac: 0, beauty: 0, immortal: 0 };
  }
  return { don: 1, mafia: 2, sheriff: 1, doctor: 1, maniac: 0, beauty: 0, immortal: 0 };
}

export function buildRoleDeck(playerCount, customConfig = null) {
  const cfg = customConfig || getDefaultDeckConfig(playerCount);
  const roles = [];

  for (let i = 0; i < (cfg.don || 0); i++) roles.push("don");
  for (let i = 0; i < (cfg.mafia || 0); i++) roles.push("mafia");
  for (let i = 0; i < (cfg.sheriff || 0); i++) roles.push("sheriff");
  for (let i = 0; i < (cfg.doctor || 0); i++) roles.push("doctor");
  for (let i = 0; i < (cfg.maniac || 0); i++) roles.push("maniac");
  for (let i = 0; i < (cfg.beauty || 0); i++) roles.push("beauty");
  for (let i = 0; i < (cfg.immortal || 0); i++) roles.push("immortal");

  // Якщо ролей більше, ніж гравців — обрізаємо до кількості гравців
  if (roles.length > playerCount) {
    roles.length = playerCount;
  }

  // Решту місць заповнюємо мирними жителями
  while (roles.length < playerCount) {
    roles.push("citizen");
  }

  return shuffle(roles);
}

export function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
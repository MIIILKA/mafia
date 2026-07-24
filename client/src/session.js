const DEVICE_TOKEN_KEY = "mafia_device_token";
const ROOM_CODE_KEY = "mafia_room_code";

export function getDeviceToken() {
  let token = localStorage.getItem(DEVICE_TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(DEVICE_TOKEN_KEY, token);
  }
  return token;
}

export function saveRoomCode(code) {
  localStorage.setItem(ROOM_CODE_KEY, code);
}

export function getSavedRoomCode() {
  return localStorage.getItem(ROOM_CODE_KEY);
}

export function clearSavedRoomCode() {
  localStorage.removeItem(ROOM_CODE_KEY);
}

import type { OpenBotDesktopApi } from "@openbot/contracts/ipc";
import { sourceText } from "@openbot/i18n/source";

export function mockBoards(): OpenBotDesktopApi["boards"] {
  const unsupported = () => Promise.reject(new Error(sourceText("error.boards.serverTooOld")));
  return {
    list: () => Promise.resolve({ boards: [] }),
    get: unsupported,
    archivedCards: () => Promise.resolve({ cards: [] }),
    apply: unsupported,
  };
}

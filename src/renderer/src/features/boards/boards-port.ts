import type { BoardArchivedCards, BoardDetail, BoardList, BoardMutation, BoardsChange } from "@openbot/contracts/ipc";
import type { BoardsThread } from "@openbot/ui/features/boards/boards-model";

export interface BoardsHost {
  list(): Promise<BoardList>;
  get(boardId: string): Promise<BoardDetail>;
  archivedCards(boardId: string): Promise<BoardArchivedCards>;
  apply(change: BoardsChange): Promise<BoardMutation>;
  threads(agentId: string): Promise<BoardsThread[]>;
  onChanged(listener: (boardId: string | null) => void): () => void;
}

export function desktopBoardsHost(serverId: string): BoardsHost {
  const api = () => window.openbot.boards;
  return {
    list: () => api().list(serverId),
    get: (boardId) => api().get({ boardId }, serverId),
    archivedCards: (boardId) => api().archivedCards({ boardId }, serverId),
    apply: (change) => api().apply(change, serverId),
    async threads(agentId) {
      const snapshot = await window.openbot.agent.listTasks(agentId, serverId);
      return snapshot.tasks.map((task) => ({ id: task.id, title: task.title }));
    },
    onChanged(listener) {
      const events = window.openbot.agent.onScopedEvent((scoped) => {
        if (scoped.serverId === serverId && scoped.event.type === "boards-changed") listener(scoped.event.boardId);
      });
      let online: boolean | undefined;
      const reconnect = window.openbot.servers.onEvent((servers) => {
        const now = servers.some((server) => server.id === serverId && server.state === "online");
        if (now && online === false) listener(null);
        online = now;
      });
      return () => {
        events();
        reconnect();
      };
    },
  };
}
